"""Telegram 长轮询服务（进程内单实例，支持多站点多 bot）。

骨架完全对齐 `services/feishu_app.py`：
- 每个启用 telegram 的站点对应一个 worker 线程
- 线程跑同步长轮询，回调通过 `asyncio.run_coroutine_threadsafe` 推回主事件循环
- 同一 bot_token 不允许配在多个 site 上（Telegram 长轮询单消费者限制）
"""

from __future__ import annotations

import asyncio
import logging
import threading
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from app.core.integration.robot.base import (
    MessageDeduplicator,
    RobotInboundEvent,
    RobotSession,
)
from app.core.integration.robot.connections.telegram_longpoll import start_longpoll_client
from app.core.integration.robot.factory import RobotFactory
from app.core.integration.robot.types.telegram_app import (
    DEFAULT_TELEGRAM_API_BASE,
    TelegramAdapterConfig,
    TelegramLongPollConfig,
)
from app.db.database import AsyncSessionLocal
from app.models.site import Site
from app.services.robot import RobotOrchestrator

logger = logging.getLogger(__name__)


@dataclass
class TelegramWorkerState:
    config: TelegramLongPollConfig
    generation: int


class TelegramRobotService:
    """Telegram 长轮询服务。"""

    _instance: TelegramRobotService | None = None

    def __init__(self) -> None:
        self._app_loop: asyncio.AbstractEventLoop | None = None
        self._service_running = False
        self._workers: dict[int, TelegramWorkerState] = {}
        self._workers_lock = threading.Lock()
        self._refresh_lock = asyncio.Lock()
        self._deduplicator = MessageDeduplicator()

    @classmethod
    def get_instance(cls) -> TelegramRobotService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def startup(self, app_loop: asyncio.AbstractEventLoop) -> None:
        self._app_loop = app_loop
        self._service_running = True
        await self.refresh()

    async def shutdown(self) -> None:
        self._service_running = False
        with self._workers_lock:
            self._workers.clear()
        logger.info("Telegram 长轮询服务已标记关闭")

    async def refresh(self) -> None:
        if not self._service_running:
            return

        if self._app_loop is None:
            try:
                self._app_loop = asyncio.get_running_loop()
            except RuntimeError:
                logger.warning("Telegram 长轮询刷新失败：无可用事件循环")
                return

        async with self._refresh_lock:
            enabled_configs = await self._pick_enabled_configs()

            with self._workers_lock:
                current_site_ids = set(self._workers.keys())
            enabled_site_ids = set(enabled_configs.keys())

            for site_id in current_site_ids - enabled_site_ids:
                self._deactivate_worker(site_id)
                logger.info("Telegram 长轮询已停用: site_id=%s", site_id)

            started_or_updated: list[int] = []
            for site_id, config in enabled_configs.items():
                state = self._get_worker(site_id)
                if state and state.config == config:
                    continue
                generation = (state.generation + 1) if state else 1
                self._set_worker(site_id, TelegramWorkerState(config=config, generation=generation))
                self._start_worker_thread(config=config, generation=generation)
                started_or_updated.append(site_id)

            if started_or_updated:
                logger.info(
                    "Telegram 长轮询已刷新: started_or_updated=%s active_sites=%s",
                    started_or_updated,
                    sorted(enabled_site_ids),
                )
            elif not enabled_site_ids:
                logger.info("Telegram 长轮询当前无启用站点")

    async def _pick_enabled_configs(self) -> dict[int, TelegramLongPollConfig]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Site).where(Site.status == "active").order_by(Site.id.asc())
            )
            sites = result.scalars().all()

        candidates: dict[int, TelegramLongPollConfig] = {}
        seen_tokens: dict[str, int] = {}
        for site in sites:
            bot_config = site.bot_config or {}
            telegram = bot_config.get("telegram_app") or {}
            if not telegram.get("enabled"):
                continue
            bot_token = (telegram.get("bot_token") or "").strip()
            if not bot_token:
                continue

            # Telegram 长轮询同一 token 只能被一个消费者拉取，重复配会 409
            if bot_token in seen_tokens:
                logger.warning(
                    "Telegram bot_token 已被 site_id=%s 占用，跳过 site_id=%s",
                    seen_tokens[bot_token],
                    site.id,
                )
                continue
            seen_tokens[bot_token] = site.id

            api_base = (telegram.get("api_base_url") or "").strip() or DEFAULT_TELEGRAM_API_BASE
            allowed_user_ids = self._parse_allowed_user_ids(telegram.get("allowed_user_ids"))

            candidates[site.id] = TelegramLongPollConfig(
                site_id=site.id,
                bot_token=bot_token,
                api_base_url=api_base,
                allowed_user_ids=allowed_user_ids,
            )
        return candidates

    @staticmethod
    def _parse_allowed_user_ids(raw: Any) -> tuple[int, ...]:
        """支持字符串（逗号分隔）或 list；非数字静默忽略。"""
        if raw is None or raw == "":
            return ()
        items: list[Any]
        if isinstance(raw, str):
            items = [s for s in (p.strip() for p in raw.split(",")) if s]
        elif isinstance(raw, list | tuple):
            items = list(raw)
        else:
            return ()
        out: list[int] = []
        for x in items:
            try:
                out.append(int(x))
            except (TypeError, ValueError):
                continue
        return tuple(out)

    def _start_worker_thread(self, *, config: TelegramLongPollConfig, generation: int) -> None:
        thread = threading.Thread(
            target=self._run_longpoll,
            args=(config, generation),
            name=f"telegram-longpoll-site-{config.site_id}-g{generation}",
            daemon=True,
        )
        thread.start()

    def _run_longpoll(self, config: TelegramLongPollConfig, generation: int) -> None:
        import time as _time

        def _on_update(update: dict[str, Any]) -> None:
            if not self._is_worker_active(config.site_id, generation, config):
                return

            adapter = RobotFactory.get_adapter("telegram_app")
            inbound_event = adapter.parse_inbound_text_event(update, config.site_id)
            if not inbound_event:
                return

            if self._deduplicator.check_and_log_duplicate(
                config.site_id, inbound_event.message_id, "Telegram 长轮询"
            ):
                return

            logger.info(
                "Telegram 长轮询收到消息: site_id=%s chat_type=%s user=%s",
                config.site_id,
                inbound_event.extra.get("chat_type"),
                inbound_event.from_user,
            )

            future = asyncio.run_coroutine_threadsafe(
                self._process_text_message(inbound_event=inbound_event, config=config),
                self._app_loop,
            )
            future.add_done_callback(
                lambda f: self._handle_process_result(f, config.site_id, inbound_event.from_user)
            )

        def _is_active() -> bool:
            return self._is_worker_active(config.site_id, generation, config)

        retry_delay = 5
        while _is_active():
            started_at = _time.monotonic()
            try:
                start_longpoll_client(config=config, on_update=_on_update, is_active=_is_active)
            except Exception:
                logger.exception(
                    "Telegram 长轮询客户端异常退出: generation=%s site_id=%s",
                    generation,
                    config.site_id,
                )
            if not _is_active():
                break
            if _time.monotonic() - started_at > 60:
                retry_delay = 5
            logger.info(
                "Telegram 长轮询客户端已退出，%ds 后重连: site_id=%s",
                retry_delay,
                config.site_id,
            )
            _time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)

    @staticmethod
    def _handle_process_result(future, site_id: int, from_user: str) -> None:
        try:
            future.result()
            logger.debug("Telegram 消息处理完成: site_id=%s user=%s", site_id, from_user)
        except Exception:
            logger.exception("Telegram 异步消息处理失败: site_id=%s user=%s", site_id, from_user)

    def _get_worker(self, site_id: int) -> TelegramWorkerState | None:
        with self._workers_lock:
            return self._workers.get(site_id)

    def _set_worker(self, site_id: int, state: TelegramWorkerState) -> None:
        with self._workers_lock:
            self._workers[site_id] = state

    def _deactivate_worker(self, site_id: int) -> None:
        with self._workers_lock:
            self._workers.pop(site_id, None)

    def _is_worker_active(
        self, site_id: int, generation: int, config: TelegramLongPollConfig
    ) -> bool:
        if not self._service_running or self._app_loop is None:
            return False
        with self._workers_lock:
            state = self._workers.get(site_id)
            return bool(state and state.generation == generation and state.config == config)

    async def _process_text_message(
        self, *, inbound_event: RobotInboundEvent, config: TelegramLongPollConfig
    ) -> None:
        adapter = RobotFactory.get_adapter("telegram_app")

        chat_id = inbound_event.extra.get("chat_id")
        if chat_id is None:
            logger.warning("Telegram 消息缺少 chat_id，无法回复: site_id=%s", inbound_event.site_id)
            return

        # 流式开始前先发一次 typing，体验上更平滑
        try:
            await adapter.client.send_chat_action(
                bot_token=config.bot_token,
                api_base_url=config.api_base_url,
                chat_id=int(chat_id),
            )
        except Exception:
            pass

        session = RobotSession(
            event=inbound_event,
            config=TelegramAdapterConfig(
                bot_token=config.bot_token,
                api_base_url=config.api_base_url,
                chat_id=int(chat_id),
            ),
        )

        await RobotOrchestrator.orchestrate_as_task(adapter=adapter, session=session)
