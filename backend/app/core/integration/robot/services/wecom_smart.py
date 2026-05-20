import asyncio
import logging
import threading
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from app.core.integration.robot.base import MessageDeduplicator, RobotSession
from app.core.integration.robot.connections.wecom_longconn import start_longconn_client
from app.core.integration.robot.factory import RobotFactory
from app.core.integration.robot.types.wecom_smart import WeComSmartLongConnConfig
from app.db.database import AsyncSessionLocal
from app.models.site import Site
from app.services.robot import RobotOrchestrator

logger = logging.getLogger(__name__)


@dataclass
class WeComSmartWorkerState:
    config: WeComSmartLongConnConfig
    generation: int


class WeComSmartService:
    """企业微信智能机器人长连接服务 (WebSocket 模式)。"""

    _instance: "WeComSmartService | None" = None

    def __init__(self) -> None:
        self._app_loop: asyncio.AbstractEventLoop | None = None
        self._service_running = False
        self._workers: dict[int, WeComSmartWorkerState] = {}
        self._workers_lock = threading.Lock()
        self._refresh_lock = asyncio.Lock()
        self._deduplicator = MessageDeduplicator()

    @classmethod
    def get_instance(cls) -> "WeComSmartService":
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
        # RobotFactory.shutdown 由 lifecycle 在所有 robot service 关闭后统一触发
        logger.info("企业微信智能机器人长连接服务已关闭")

    async def refresh(self) -> None:
        if not self._service_running:
            return

        if self._app_loop is None:
            try:
                self._app_loop = asyncio.get_running_loop()
            except RuntimeError:
                logger.warning("企微智能机器人长连接刷新失败：无可用事件循环")
                return

        async with self._refresh_lock:
            enabled_configs = await self._pick_enabled_configs()

            with self._workers_lock:
                current_site_ids = set(self._workers.keys())
            enabled_site_ids = set(enabled_configs.keys())

            for site_id in current_site_ids - enabled_site_ids:
                self._deactivate_worker(site_id)
                logger.info("企微智能机器人长连接已停用: site_id=%s", site_id)

            started_or_updated: list[int] = []
            for site_id, config in enabled_configs.items():
                state = self._get_worker(site_id)
                if state and state.config == config:
                    continue

                generation = (state.generation + 1) if state else 1
                self._set_worker(
                    site_id, WeComSmartWorkerState(config=config, generation=generation)
                )
                self._start_worker_thread(config=config, generation=generation)
                started_or_updated.append(site_id)

            if started_or_updated:
                logger.info(
                    "企微智能机器人长连接已刷新: started_or_updated=%s active_sites=%s",
                    started_or_updated,
                    sorted(enabled_site_ids),
                )
            elif not enabled_site_ids:
                logger.info("企微智能机器人长连接当前无启用站点")

    async def _pick_enabled_configs(self) -> dict[int, WeComSmartLongConnConfig]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Site).where(Site.status == "active").order_by(Site.id.asc())
            )
            sites = result.scalars().all()

        candidates: dict[int, WeComSmartLongConnConfig] = {}
        for site in sites:
            bot_config = site.bot_config or {}
            wecom = bot_config.get("wecom_smart") or {}
            enabled = bool(wecom.get("enabled"))
            bot_id = (wecom.get("bot_id") or "").strip()
            secret = (wecom.get("secret") or "").strip()
            if enabled and bot_id and secret:
                candidates[site.id] = WeComSmartLongConnConfig(
                    site_id=site.id, bot_id=bot_id, secret=secret
                )
        return candidates

    def _start_worker_thread(self, *, config: WeComSmartLongConnConfig, generation: int) -> None:
        thread = threading.Thread(
            target=self._run_ws_client,
            args=(config, generation),
            name=f"wecom-smart-longconn-site-{config.site_id}-g{generation}",
            daemon=True,
        )
        thread.start()

    def _run_ws_client(self, config: WeComSmartLongConnConfig, generation: int) -> None:
        import time as _time

        import websockets

        def _on_event(cmd: str, raw_data: Any) -> None:
            if not self._is_worker_active(config.site_id, generation, config):
                return

            if cmd == "aibot_msg_callback":
                adapter = RobotFactory.get_adapter("wecom_smart")
                inbound_event = adapter.parse_inbound_text_event(raw_data, config.site_id)
                if not inbound_event:
                    return

                if self._deduplicator.check_and_log_duplicate(
                    config.site_id, inbound_event.message_id, "企微智能机器人"
                ):
                    return

                logger.info(
                    "企微智能机器人长连接收到消息: site_id=%s user=%s",
                    config.site_id,
                    inbound_event.from_user,
                )

                asyncio.run_coroutine_threadsafe(
                    self._process_text_message(inbound_event=inbound_event),
                    self._app_loop,
                )
            elif cmd == "aibot_event_callback":
                # TODO: 解析事件类型（如 enter_session 触发欢迎语），当前不处理
                pass

        retry_delay = 5
        while self._is_worker_active(config.site_id, generation, config):
            started_at = _time.monotonic()
            try:
                asyncio.run(start_longconn_client(config=config, on_event=_on_event))
            except Exception as e:
                if isinstance(e, websockets.exceptions.ConnectionClosed):
                    logger.info("企微智能机器人长连接已断开: site_id=%s", config.site_id)
                else:
                    logger.exception(
                        "企微智能机器人长连接客户端异常退出: generation=%s site_id=%s",
                        generation,
                        config.site_id,
                    )
            if not self._is_worker_active(config.site_id, generation, config):
                break
            if _time.monotonic() - started_at > 60:
                retry_delay = 5
            logger.info(
                "企微智能机器人长连接已退出，%ds 后重连: site_id=%s",
                retry_delay,
                config.site_id,
            )
            _time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)

    def _is_worker_active(
        self, site_id: int, generation: int, config: WeComSmartLongConnConfig
    ) -> bool:
        if not self._service_running or self._app_loop is None:
            return False
        with self._workers_lock:
            state = self._workers.get(site_id)
            return bool(state and state.generation == generation and state.config == config)

    async def _process_text_message(self, *, inbound_event: Any) -> None:
        # 获取适配器与会话
        adapter = RobotFactory.get_adapter("wecom_smart")
        session = RobotSession(event=inbound_event)

        # 调用统一编排流程
        await RobotOrchestrator.orchestrate_as_task(
            adapter=adapter,
            session=session,
        )

    def _get_worker(self, site_id: int) -> WeComSmartWorkerState | None:
        with self._workers_lock:
            return self._workers.get(site_id)

    def _set_worker(self, site_id: int, state: WeComSmartWorkerState) -> None:
        with self._workers_lock:
            self._workers[site_id] = state

    def _deactivate_worker(self, site_id: int) -> None:
        with self._workers_lock:
            self._workers.pop(site_id, None)
