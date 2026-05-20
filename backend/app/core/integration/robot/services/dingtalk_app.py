import asyncio
import logging
import threading
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from app.core.integration.robot.base import MessageDeduplicator, RobotInboundEvent, RobotSession
from app.core.integration.robot.connections.dingtalk_longconn import start_longconn_client
from app.core.integration.robot.factory import RobotFactory
from app.core.integration.robot.types.dingtalk_app import (
    DingTalkStreamConfig,
)
from app.crud.site import crud_site
from app.db.database import AsyncSessionLocal
from app.models.site import Site
from app.services.robot import RobotOrchestrator

logger = logging.getLogger(__name__)


@dataclass
class DingTalkWorkerState:
    config: DingTalkStreamConfig
    generation: int


class DingTalkRobotService:
    """钉钉机器人 Stream 服务（进程内单实例，支持多站点多连接）。"""

    _instance: "DingTalkRobotService | None" = None

    def __init__(self) -> None:
        self._app_loop: asyncio.AbstractEventLoop | None = None
        self._service_running = False
        self._workers: dict[int, DingTalkWorkerState] = {}
        self._workers_lock = threading.Lock()
        self._refresh_lock = asyncio.Lock()
        self._deduplicator = MessageDeduplicator()

    @classmethod
    def get_instance(cls) -> "DingTalkRobotService":
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
        # 不在此处调用 RobotFactory.shutdown()：lifecycle.shutdown 会在所有
        # robot service 关闭后单独触发一次，避免 3 个 service 各自 shutdown
        # 工厂的重复调用。
        logger.info("钉钉 Stream 服务已关闭")

    async def refresh(self) -> None:
        if not self._service_running:
            return

        if self._app_loop is None:
            try:
                self._app_loop = asyncio.get_running_loop()
            except RuntimeError:
                logger.warning("钉钉 Stream 刷新失败：无可用事件循环")
                return

        async with self._refresh_lock:
            enabled_configs = await self._pick_enabled_configs()

            with self._workers_lock:
                current_site_ids = set(self._workers.keys())
            enabled_site_ids = set(enabled_configs.keys())

            for site_id in current_site_ids - enabled_site_ids:
                self._deactivate_worker(site_id)
                logger.info("钉钉 Stream 已停用: site_id=%s", site_id)

            started_or_updated: list[int] = []
            for site_id, config in enabled_configs.items():
                state = self._get_worker(site_id)
                if state and state.config == config:
                    continue

                generation = (state.generation + 1) if state else 1
                self._set_worker(site_id, DingTalkWorkerState(config=config, generation=generation))
                self._start_worker_thread(config=config, generation=generation)
                started_or_updated.append(site_id)

            if started_or_updated:
                logger.info(
                    "钉钉 Stream 已刷新: started_or_updated=%s active_sites=%s",
                    started_or_updated,
                    sorted(enabled_site_ids),
                )
            elif not enabled_site_ids:
                logger.info("钉钉 Stream 当前无启用站点")

    async def _pick_enabled_configs(self) -> dict[int, DingTalkStreamConfig]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Site).where(Site.status == "active").order_by(Site.id.asc())
            )
            sites = result.scalars().all()

        candidates: dict[int, DingTalkStreamConfig] = {}
        for site in sites:
            bot_config = site.bot_config or {}
            dingtalk = bot_config.get("dingtalk_app") or {}
            enabled = bool(dingtalk.get("enabled"))
            client_id = (dingtalk.get("client_id") or "").strip()
            client_secret = (dingtalk.get("client_secret") or "").strip()
            if enabled and client_id and client_secret:
                candidates[site.id] = DingTalkStreamConfig(
                    site_id=site.id,
                    client_id=client_id,
                    client_secret=client_secret,
                )
        return candidates

    def _start_worker_thread(self, *, config: DingTalkStreamConfig, generation: int) -> None:
        thread = threading.Thread(
            target=self._run_stream_client,
            args=(config, generation),
            name=f"dingtalk-stream-site-{config.site_id}-g{generation}",
            daemon=True,
        )
        thread.start()

    def _run_stream_client(self, config: DingTalkStreamConfig, generation: int) -> None:
        import time as _time

        def _on_text_event(raw_data: Any) -> None:
            if not self._is_worker_active(config.site_id, generation, config):
                return

            adapter = RobotFactory.get_adapter("dingtalk_app")
            inbound_event = adapter.parse_inbound_text_event(raw_data, config.site_id)
            if not inbound_event:
                return

            if self._deduplicator.check_and_log_duplicate(
                config.site_id, inbound_event.message_id, "钉钉 Stream"
            ):
                return

            logger.info(
                "钉钉 Stream 收到消息: conversation_type=%s site_id=%s user=%s",
                inbound_event.extra.get("conversation_type"),
                config.site_id,
                inbound_event.from_user,
            )

            future = asyncio.run_coroutine_threadsafe(
                self._process_text_message(
                    inbound_event=inbound_event,
                    config=config,
                ),
                self._app_loop,
            )
            future.add_done_callback(
                lambda f: self._handle_process_result(f, config.site_id, inbound_event.from_user)
            )

        retry_delay = 5
        while self._is_worker_active(config.site_id, generation, config):
            started_at = _time.monotonic()
            try:
                start_longconn_client(config=config, on_text_event=_on_text_event)
            except Exception:
                logger.exception(
                    "钉钉 Stream 客户端异常退出: generation=%s site_id=%s",
                    generation,
                    config.site_id,
                )
            if not self._is_worker_active(config.site_id, generation, config):
                break
            # 运行超过 60s 视为曾成功连接，重置退避
            if _time.monotonic() - started_at > 60:
                retry_delay = 5
            logger.info(
                "钉钉 Stream 客户端已退出，%ds 后重连: site_id=%s", retry_delay, config.site_id
            )
            _time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)

    @staticmethod
    def _handle_process_result(future, site_id: int, from_user: str) -> None:
        try:
            future.result()
            logger.debug("钉钉消息回复任务提交成功: site_id=%s user=%s", site_id, from_user)
        except Exception:
            logger.exception("钉钉异步消息处理失败: site_id=%s user=%s", site_id, from_user)

    def _get_worker(self, site_id: int) -> DingTalkWorkerState | None:
        with self._workers_lock:
            return self._workers.get(site_id)

    def _set_worker(self, site_id: int, state: DingTalkWorkerState) -> None:
        with self._workers_lock:
            self._workers[site_id] = state

    def _deactivate_worker(self, site_id: int) -> None:
        with self._workers_lock:
            self._workers.pop(site_id, None)

    def _is_worker_active(
        self, site_id: int, generation: int, config: DingTalkStreamConfig
    ) -> bool:
        if not self._service_running or self._app_loop is None:
            return False
        with self._workers_lock:
            state = self._workers.get(site_id)
            return bool(state and state.generation == generation and state.config == config)

    async def _process_text_message(
        self, *, inbound_event: RobotInboundEvent, config: DingTalkStreamConfig
    ) -> None:
        async with AsyncSessionLocal() as db:
            site = await crud_site.get(db, id=inbound_event.site_id)
            if site is None:
                logger.warning(
                    "钉钉 Stream 收到消息但站点不存在: site_id=%s", inbound_event.site_id
                )
                return

            # 获取适配器与会话
            adapter = RobotFactory.get_adapter("dingtalk_app")

            # 获取当前站点的模板 ID (可能已动态变更)
            bot_config = site.bot_config or {}
            dingtalk_cfg = bot_config.get("dingtalk_app") or {}
            template_id = dingtalk_cfg.get("template_id")

            from app.core.integration.robot.types.dingtalk_app import DingTalkAdapterConfig

            session = RobotSession(
                event=inbound_event,
                config=DingTalkAdapterConfig(
                    client_id=config.client_id,
                    client_secret=config.client_secret,
                    template_id=template_id,
                ),
            )

            # 调用统一编排流程
            await RobotOrchestrator.orchestrate_as_task(
                adapter=adapter,
                session=session,
            )
