"""Telegram 长轮询连接器。

设计要点：
1. **同步 httpx**：本函数在 worker 线程里跑，调用同步 `httpx.Client.post`，
   每次 `getUpdates` 的 long-polling 超时设为 25s（小于服务器 30s 上限）。
2. **offset 持久化**：进程内变量；重启会跳到"最新"（首次拉取用 offset=-1 抢
   一条 update 拿到最新 update_id，再 +1 推进）。这意味着重启期间的消息可能
   丢失，但避免了重放历史风暴。如果未来要求"零丢消息"，再接 Redis。
3. **回调签名**：把 update dict 透传给 service 层，由 adapter 解析。
4. **bot_username 注入**：在 update dict 里塞 `_bot_username`，供 adapter
   剥离群聊里 @bot 提及。
5. **退避**：getMe 失败 → 抛 RuntimeError 让 service 走重连退避；getUpdates
   中网络抖动 → 短 sleep 后继续，不计退避。
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any

import httpx

from app.core.integration.robot.types.telegram_app import (
    DEFAULT_TELEGRAM_API_BASE,
    TelegramLongPollConfig,
)

logger = logging.getLogger(__name__)

# Telegram getUpdates 的 long-polling 超时（秒）。Telegram 上限 50s，设小一点更
# 能感知到长连接死亡，重启 worker 更及时。
LONG_POLL_TIMEOUT = 25


def _build_url(api_base_url: str, bot_token: str, method: str) -> str:
    base = (api_base_url or DEFAULT_TELEGRAM_API_BASE).rstrip("/")
    return f"{base}/bot{bot_token}/{method}"


def _call_sync(
    *,
    http_client: httpx.Client,
    api_base_url: str,
    bot_token: str,
    method: str,
    payload: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> dict[str, Any]:
    url = _build_url(api_base_url, bot_token, method)
    resp = http_client.post(url, json=payload or {}, timeout=timeout)
    try:
        data = resp.json()
    except ValueError as e:
        raise RuntimeError(f"Telegram {method} 非 JSON 响应: {resp.text[:200]}") from e
    if resp.status_code >= 400 or not data.get("ok"):
        raise RuntimeError(
            f"Telegram {method} 失败: status={resp.status_code} desc={data.get('description')}"
        )
    return data.get("result") or {}


def start_longpoll_client(
    *,
    config: TelegramLongPollConfig,
    on_update: Callable[[dict[str, Any]], None],
    is_active: Callable[[], bool],
) -> None:
    """启动一个 Telegram 长轮询循环。仅在 `is_active()` 为 True 时持续工作。

    抛出 RuntimeError 表示需要 service 走重连退避（典型场景：token 失效、
    api_base 不可达）。其他临时错误内部消化。
    """
    # 1) 启动自检：拿 bot username（用于群聊去 @）
    with httpx.Client(timeout=LONG_POLL_TIMEOUT + 10) as http_client:
        try:
            me = _call_sync(
                http_client=http_client,
                api_base_url=config.api_base_url,
                bot_token=config.bot_token,
                method="getMe",
                timeout=10.0,
            )
        except Exception as e:
            raise RuntimeError(f"Telegram getMe 失败: {e}") from e

        bot_username = me.get("username") or ""
        logger.info(
            "Telegram 长轮询已就绪: site_id=%s bot=@%s",
            config.site_id,
            bot_username,
        )

        # 2) 拿到一个起始 offset（offset=-1 → 服务器返回最近 1 条 update）
        offset: int | None = None
        try:
            first_batch = _call_sync(
                http_client=http_client,
                api_base_url=config.api_base_url,
                bot_token=config.bot_token,
                method="getUpdates",
                payload={"offset": -1, "limit": 1, "timeout": 0},
                timeout=10.0,
            )
            if isinstance(first_batch, list) and first_batch:
                last = first_batch[-1]
                if isinstance(last, dict) and isinstance(last.get("update_id"), int):
                    offset = last["update_id"] + 1
        except Exception:
            logger.warning("Telegram 初始 offset 探测失败，将从 0 开始: site_id=%s", config.site_id)

        # 3) 进入主循环
        allowed_user_ids = set(config.allowed_user_ids or ())
        backoff = 0.0
        while is_active():
            if backoff:
                # 简单非阻塞睡眠，is_active 失活时尽快退出
                time.sleep(min(backoff, 5.0))
                backoff = max(0.0, backoff - 5.0)
                if not is_active():
                    break

            payload: dict[str, Any] = {
                "timeout": LONG_POLL_TIMEOUT,
                "allowed_updates": ["message"],
            }
            if offset is not None:
                payload["offset"] = offset

            try:
                updates = _call_sync(
                    http_client=http_client,
                    api_base_url=config.api_base_url,
                    bot_token=config.bot_token,
                    method="getUpdates",
                    payload=payload,
                    timeout=LONG_POLL_TIMEOUT + 10,
                )
            except httpx.ReadTimeout:
                # long-polling 自然超时，正常重连
                continue
            except httpx.HTTPError as e:
                logger.warning("Telegram getUpdates 网络异常: site_id=%s err=%s", config.site_id, e)
                backoff = 5.0
                continue
            except RuntimeError as e:
                # 接口层错误（如 401 token 无效）→ 上抛，由 service 走指数退避
                raise RuntimeError(f"Telegram getUpdates 致命错误: {e}") from e

            if not isinstance(updates, list):
                continue

            for upd in updates:
                if not isinstance(upd, dict):
                    continue
                if isinstance(upd.get("update_id"), int):
                    offset = max(offset or 0, upd["update_id"] + 1)

                # 白名单检查
                if allowed_user_ids:
                    msg = upd.get("message") or upd.get("edited_message") or {}
                    from_id = (msg.get("from") or {}).get("id")
                    if from_id not in allowed_user_ids:
                        continue

                # 把 bot_username 注入 update，方便 adapter 剥离 @ 提及
                upd["_bot_username"] = bot_username

                try:
                    on_update(upd)
                except Exception:
                    logger.exception(
                        "Telegram update 回调失败（已忽略，继续推进 offset）: site_id=%s",
                        config.site_id,
                    )
