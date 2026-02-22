import asyncio
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import BackgroundTasks

from app.core.integration.robot.base import BaseRobotAdapter, RobotSession
from app.schemas.chat import ChatCompletionRequest
from app.schemas.document import VectorRetrieveFilter
from app.services.chat.chat_service import ChatService

logger = logging.getLogger(__name__)


class RobotOrchestrator:
    """机器人通用消息处理（充当 Orchestrator 角色）。"""

    DEFAULT_ERROR_REPLY = "服务暂时繁忙，请稍后再试。"
    DEFAULT_TIMEOUT_REPLY = "服务响应超时，请稍后再试。"
    DEFAULT_EMPTY_REPLY = "抱歉，我暂时无法回答这个问题。"

    @classmethod
    async def orchestrate_reply(
        cls,
        *,
        adapter: BaseRobotAdapter,
        session: RobotSession,
        background_tasks: BackgroundTasks | None = None,
    ) -> None:
        """
        核心编排逻辑：流式 AI 推理 + 实时推送 + 异常处理。
        """
        full_answer = ""
        provider = adapter.get_provider_name()
        start_time = time.time()
        last_sync_time = start_time
        sync_count = 0
        token_count = 0
        # 获取平台建议的同步间隔
        sync_interval = adapter.get_sync_interval()

        try:
            # 1. 发送初始状态（如飞书发送空白卡片）
            await adapter.reply(session, "", is_finish=False)

            # 2. 启动流式推理
            async for chunk in cls.stream_ask(
                provider=provider,
                site_id=session.event.site_id,
                thread_id=f"{provider.lower()}-robot-{session.event.from_user}",
                user=session.event.from_user,
                content=session.event.content,
                background_tasks=background_tasks,
            ):
                token_count += 1
                full_answer += chunk

                # 3. 节流推送到适配器
                now = time.time()
                if now - last_sync_time >= sync_interval:
                    try:
                        await adapter.reply(session, full_answer, is_finish=False)
                        last_sync_time = now
                        sync_count += 1
                    except Exception as e:
                        logger.warning("%s 流式更新失败 (待下次重试): %s", provider, e)

            # 4. 最终全量更新
            await adapter.reply(session, full_answer, is_finish=True)
            sync_count += 1

            total_duration = time.time() - start_time
            logger.info(
                "🚀 %s 消息编排完成: 总耗时=%.2fs, Token数=%d, 同步次数=%d (节流比=%.2f)",
                provider,
                total_duration,
                token_count,
                sync_count,
                token_count / sync_count if sync_count > 0 else 0,
            )

        except Exception as e:
            logger.exception("%s 消息编排流异常: %s", provider, e)
            try:
                await adapter.reply(session, full_answer, is_error=True)
            except Exception:
                logger.error("%s 错误状态更新失败", provider)
        finally:
            if background_tasks:
                try:
                    await background_tasks()
                except Exception as e:
                    logger.error("执行后台任务失败: %s", e)

    @classmethod
    async def ask(
        cls,
        *,
        provider: str,
        site_id: int,
        thread_id: str,
        user: str,
        content: str,
        background_tasks: BackgroundTasks | None = None,
        timeout_seconds: int = 90,
    ) -> str:
        chat_request = ChatCompletionRequest(
            message=content,
            thread_id=thread_id,
            user=user,
            stream=False,
            filter=VectorRetrieveFilter(site_id=site_id),
        )

        answer = cls.DEFAULT_EMPTY_REPLY
        try:
            response = await asyncio.wait_for(
                ChatService.process_chat_request(
                    chat_request, background_tasks or BackgroundTasks()
                ),
                timeout=timeout_seconds,
            )
            msg = cls._extract_first_message_content(response)
            if msg:
                answer = msg
        except TimeoutError:
            logger.error("%s AI 推理超时（%ss）: site_id=%s", provider, timeout_seconds, site_id)
            answer = cls.DEFAULT_TIMEOUT_REPLY
        except Exception as e:
            logger.error("%s AI 推理失败: %s", provider, e, exc_info=True)
            answer = cls.DEFAULT_ERROR_REPLY
        return answer

    @classmethod
    async def stream_ask(
        cls,
        *,
        provider: str,
        site_id: int,
        thread_id: str,
        user: str,
        content: str,
        background_tasks: BackgroundTasks | None = None,
    ) -> AsyncGenerator[str, None]:
        """流式获取消息内容（直接获取纯文本碎片，不再通过 SSE 解析）。"""
        from app.core.ai.graph import create_agent_graph
        from app.core.ai.graph.checkpointer import get_checkpointer
        from app.schemas.chat import ChatCompletionChunk

        background_tasks = background_tasks or BackgroundTasks()

        try:
            # 1. 使用 ChatService 统一初始化上下文 (llm, 初始状态, 数据库持久化等)
            llm, initial_state, config, _ = await ChatService.initialize_chat_context(
                thread_id=thread_id,
                site_id=site_id,
                user_id=user,
                message=content,
            )

            # 2. 启动流式推理并直接 yield 文本

            async with get_checkpointer() as cp:
                graph = create_agent_graph(checkpointer=cp, model=llm)
                async for chunk in ChatService.generate_chat_chunks(
                    graph, initial_state, config, llm.model_name, thread_id, background_tasks
                ):
                    if isinstance(chunk, ChatCompletionChunk):
                        content_piece = chunk.choices[0].delta.content
                        if content_piece:
                            logger.debug("AI 产出 Token 片段: len=%d", len(content_piece))
                            yield content_piece
        except Exception as e:
            logger.error("%s AI 流式推理失败: %s", provider, e, exc_info=True)
            yield cls.DEFAULT_ERROR_REPLY

    @staticmethod
    def _extract_first_message_content(response: Any) -> str | None:
        if not hasattr(response, "choices") or not response.choices:
            return None
        msg = response.choices[0].message
        if not msg or not msg.content:
            return None
        return msg.content
