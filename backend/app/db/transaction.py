# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import functools
import logging
from collections.abc import Callable
from typing import Any, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def on_commit(db: AsyncSession, callback: Callable[..., Any], *args: Any, **kwargs: Any):
    """
    [✨ 亮点] 注册一个在当前事务成功提交后执行的异步回调函数。

    这对于需要在 DB 记录可见后才触发的副作用（如分发后台任务、清理缓存等）非常有用。
    """
    if "after_commit" not in db.info:
        db.info["after_commit"] = []
    db.info["after_commit"].append((callback, args, kwargs))


def transactional() -> Callable[[F], F]:
    """
    [✨ 亮点] 自动事务管理装饰器。

    该装饰器旨在简化 Service 层中的手动事务管理。

    功能:
    1. 自动寻找 AsyncSession (从 self.db 或参数中)。
    2. 支持嵌套事务 (利用 Savepoints / begin_nested)。
    3. 方法成功执行后自动 commit，抛出异常时自动 rollback。
    4. 支持事务提交后的回调 (on_commit)。
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # 1. 自动寻找异步数据库会话 (Session)
            db: AsyncSession | None = None

            # 首先从第一个类参数 (self/cls) 中寻找 .db 属性 (标准 Service 模式)
            if args and hasattr(args[0], "db") and isinstance(args[0].db, AsyncSession):
                db = args[0].db

            # 备选: 从位置参数或关键字参数中寻找
            if not db:
                for arg in args:
                    if isinstance(arg, AsyncSession):
                        db = arg
                        break
                if not db:
                    db = kwargs.get("db")

            # 如果完全没找到 session，则普通调用
            if not db:
                logger.warning(
                    f"⚠️ '@transactional' 装饰器在方法 '{func.__name__}' 中未发现有效 AsyncSession，跳过自动事务。"
                )
                return await func(*args, **kwargs)

            # 2. 事务生命周期管控
            # 使用 db.info 追踪装饰器嵌套深度
            if "transaction_depth" not in db.info:
                db.info["transaction_depth"] = 0

            is_entry = db.info["transaction_depth"] == 0
            db.info["transaction_depth"] += 1

            try:
                # 核心修复：如果 session 已经在事务中（例如 Depends 注入时的 read 操作导致 autobegin）
                # 则不能再调用 .begin()，必须使用 .begin_nested()。
                if db.in_transaction():
                    logger.debug(
                        f"⛓️ 发现已有事务 (可能来自前置读取)，开启嵌套/子事务: {func.__name__}"
                    )
                    async with db.begin_nested():
                        result = await func(*args, **kwargs)

                    # 关键点：如果是入口方法，且因为 autobegin 导致事务未被 'async with' 管理提交，
                    # 我们必须在此显式提交，否则该事务会一直挂起直到请求结束，
                    # 导致在 on_commit 回调中启动的 Worker 无法查到尚未提交的数据。
                    if is_entry:
                        await db.commit()
                        logger.debug(f"🚀 顶层事务已通过显式 commit 提交: {func.__name__}")
                else:
                    logger.debug(f"🧱 开启新顶层事务: {func.__name__}")
                    async with db.begin():
                        result = await func(*args, **kwargs)

                # 3. 处理提交后回调 (仅在最顶层入口执行)
                if is_entry:
                    if "after_commit" in db.info:
                        callbacks = db.info.pop("after_commit")
                        logger.debug(f"🚀 事务已提交，开始执行 {len(callbacks)} 个回调...")
                        for cb, cb_args, cb_kwargs in callbacks:
                            try:
                                await cb(*cb_args, **cb_kwargs)
                            except Exception as e:
                                logger.error(f"❌ after_commit 回调执行失败: {e}", exc_info=True)
                    else:
                        logger.debug(f"✅ 事务已提交，无待执行回调: {func.__name__}")

                return result

            except Exception as e:
                # 异常抛出，如果是顶层则清理回调
                if is_entry:
                    db.info.pop("after_commit", None)
                    # 如果是 autobegin 模式下的顶层异常，需要显式回滚
                    if db.in_transaction() and not db.in_nested_transaction():
                        await db.rollback()

                logger.info(f"🛑 事务在方法 '{func.__name__}' 中遭遇异常并回滚: {e}")
                raise
            finally:
                # 恢复计数器
                db.info["transaction_depth"] -= 1
                if db.info["transaction_depth"] <= 0:
                    db.info.pop("transaction_depth", None)

        return wrapper  # type: ignore

    return decorator
