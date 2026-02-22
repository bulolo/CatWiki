import asyncio
import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from app.core.integration.robot.base import RobotInboundEvent, RobotSession
from app.core.integration.robot.factory import RobotFactory
from app.core.integration.robot.feishu import FeishuLongConnConfig
from app.core.integration.robot.feishu.longconn import start_longconn_client
from app.db.database import AsyncSessionLocal
from app.models.site import Site
from app.services.robot import RobotOrchestrator

logger = logging.getLogger(__name__)


@dataclass
class FeishuWorkerState:
    config: FeishuLongConnConfig
    generation: int


class FeishuRobotService:
    """飞书长连接服务（进程内单实例，支持多站点多连接）。"""

    _instance: "FeishuRobotService | None" = None

    def __init__(self) -> None:
        self._app_loop: asyncio.AbstractEventLoop | None = None
        self._service_running = False
        self._workers: dict[int, FeishuWorkerState] = {}
        self._workers_lock = threading.Lock()
        self._refresh_lock = asyncio.Lock()
        self._processed_lock = threading.Lock()
        self._processed_message_ids: OrderedDict[str, float] = OrderedDict()
        self._processed_ttl_seconds = 600
        self._processed_max_size = 2000

    @classmethod
    def get_instance(cls) -> "FeishuRobotService":
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
        await RobotFactory.shutdown()
        logger.info("飞书长连接服务已标记关闭，已释放工厂及客户端资源")

    async def refresh(self) -> None:
        if not self._service_running:
            return

        if self._app_loop is None:
            try:
                self._app_loop = asyncio.get_running_loop()
            except RuntimeError:
                logger.warning("飞书长连接刷新失败：无可用事件循环")
                return

        async with self._refresh_lock:
            enabled_configs = await self._pick_enabled_configs()

            with self._workers_lock:
                current_site_ids = set(self._workers.keys())
            enabled_site_ids = set(enabled_configs.keys())

            for site_id in current_site_ids - enabled_site_ids:
                self._deactivate_worker(site_id)
                logger.info("飞书长连接已停用: site_id=%s", site_id)

            started_or_updated: list[int] = []
            for site_id, config in enabled_configs.items():
                state = self._get_worker(site_id)
                if state and state.config == config:
                    continue

                generation = (state.generation + 1) if state else 1
                self._set_worker(site_id, FeishuWorkerState(config=config, generation=generation))
                self._start_worker_thread(config=config, generation=generation)
                started_or_updated.append(site_id)

            if started_or_updated:
                logger.info(
                    "飞书长连接已刷新: started_or_updated=%s active_sites=%s",
                    started_or_updated,
                    sorted(enabled_site_ids),
                )
            elif not enabled_site_ids:
                logger.info("飞书长连接当前无启用站点")

    async def _pick_enabled_configs(self) -> dict[int, FeishuLongConnConfig]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Site).where(Site.status == "active").order_by(Site.id.asc())
            )
            sites = result.scalars().all()

        candidates: dict[int, FeishuLongConnConfig] = {}
        for site in sites:
            bot_config = site.bot_config or {}
            feishu = bot_config.get("feishuBot") or {}
            enabled = bool(feishu.get("enabled"))
            app_id = (feishu.get("appId") or "").strip()
            app_secret = (feishu.get("appSecret") or "").strip()
            if enabled and app_id and app_secret:
                candidates[site.id] = FeishuLongConnConfig(
                    site_id=site.id, app_id=app_id, app_secret=app_secret
                )
        return candidates

    def _start_worker_thread(self, *, config: FeishuLongConnConfig, generation: int) -> None:
        thread = threading.Thread(
            target=self._run_ws_client,
            args=(config, generation),
            name=f"feishu-longconn-site-{config.site_id}-g{generation}",
            daemon=True,
        )
        thread.start()

    def _run_ws_client(self, config: FeishuLongConnConfig, generation: int) -> None:
        def _on_text_event(raw_data: Any) -> None:
            if not self._is_worker_active(config.site_id, generation, config):
                return

            adapter = RobotFactory.get_adapter("feishu")
            inbound_event = adapter.parse_inbound_text_event(raw_data, config.site_id)
            if not inbound_event:
                return

            if inbound_event.extra.get("sender_type") == "app":
                return
            if inbound_event.message_id and self._is_duplicate_message(inbound_event.message_id):
                logger.debug("飞书长连接忽略重复消息: message_id=%s", inbound_event.message_id)
                return

            logger.info(
                "飞书长连接收到消息: receive_id_type=%s site_id=%s user=%s",
                inbound_event.extra.get("receive_id_type"),
                config.site_id,
                inbound_event.from_user,
            )

            future = asyncio.run_coroutine_threadsafe(
                self._process_text_message(
                    inbound_event=inbound_event,
                    app_id=config.app_id,
                    app_secret=config.app_secret,
                ),
                self._app_loop,
            )
            future.add_done_callback(
                lambda f: self._handle_process_result(
                    f, inbound_event.extra.get("receive_id_type"), config.site_id
                )
            )

        try:
            start_longconn_client(config=config, on_text_event=_on_text_event)
        except Exception:
            logger.exception(
                "飞书长连接客户端异常退出: generation=%s site_id=%s", generation, config.site_id
            )

    @staticmethod
    def _handle_process_result(future, receive_id_type: str, site_id: int) -> None:
        try:
            future.result()
            logger.debug(
                "飞书长连接消息处理完成: receive_id_type=%s site_id=%s",
                receive_id_type,
                site_id,
            )
        except Exception:
            logger.exception("飞书长连接异步消息处理失败: site_id=%s", site_id)

    def _is_duplicate_message(self, message_id: str) -> bool:
        now = time.time()
        with self._processed_lock:
            self._evict_processed(now)
            if message_id in self._processed_message_ids:
                return True
            self._processed_message_ids[message_id] = now
            self._processed_message_ids.move_to_end(message_id)
            if len(self._processed_message_ids) > self._processed_max_size:
                self._processed_message_ids.popitem(last=False)
            return False

    def _evict_processed(self, now: float) -> None:
        expire_before = now - self._processed_ttl_seconds
        while self._processed_message_ids:
            first_key = next(iter(self._processed_message_ids))
            ts = self._processed_message_ids[first_key]
            if ts >= expire_before:
                break
            self._processed_message_ids.popitem(last=False)

    def _get_worker(self, site_id: int) -> FeishuWorkerState | None:
        with self._workers_lock:
            return self._workers.get(site_id)

    def _set_worker(self, site_id: int, state: FeishuWorkerState) -> None:
        with self._workers_lock:
            self._workers[site_id] = state

    def _deactivate_worker(self, site_id: int) -> None:
        with self._workers_lock:
            self._workers.pop(site_id, None)

    def _is_worker_active(
        self, site_id: int, generation: int, config: FeishuLongConnConfig
    ) -> bool:
        if not self._service_running or self._app_loop is None:
            return False
        with self._workers_lock:
            state = self._workers.get(site_id)
            return bool(state and state.generation == generation and state.config == config)

    async def _process_text_message(
        self,
        *,
        inbound_event: RobotInboundEvent,
        app_id: str,
        app_secret: str,
    ) -> None:
        # 获取适配器与会话
        adapter = RobotFactory.get_adapter("feishu")
        from app.core.integration.robot.feishu.types import FeishuAdapterConfig

        session = RobotSession(
            event=inbound_event, config=FeishuAdapterConfig(app_id=app_id, app_secret=app_secret)
        )

        # 调用统一编排流程
        # 注意：这里不再需要手动创建 db session，orchestrate_reply 内部会处理推理逻辑
        from fastapi import BackgroundTasks

        await RobotOrchestrator.orchestrate_reply(
            adapter=adapter,
            session=session,
            background_tasks=BackgroundTasks(),
        )
