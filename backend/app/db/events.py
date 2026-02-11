# Copyright 2024 CatWiki Authors
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

"""
SQLAlchemy 事件监听器
实现对多租户数据的自动过滤
"""

import logging
from sqlalchemy import event
from sqlalchemy import true, literal
from sqlalchemy.orm import with_loader_criteria, Session
from app.db.base import Base
from app.core.tenant import get_current_tenant

logger = logging.getLogger(__name__)


def register_tenant_filters(session_factory=None):
    """
    注册租户过滤拦截器。
    注意：在 SQLAlchemy 2.0 中，直接在 Session 类上注册 do_orm_execute
    比在 async_sessionmaker 上注册更稳定，可以避开某些环境下的 InvalidRequestError。
    """

    @event.listens_for(Session, "do_orm_execute")
    def apply_tenant_filter(execute_state):
        """
        在 ORM 执行前拦截并注入 tenant_id 过滤条件
        """
        # 1. 获取当前上下文中的租户 ID
        tenant_id = get_current_tenant()

        # 2. 如果存在有效租户 ID，则应用过滤
        # 注意：此处不仅是 select，也包括 update/delete 的 ORM 模式
        if tenant_id is not None:
            # 提前包装租户 ID，解决 lambda 闭包变量缓存追踪问题
            tid_literal = literal(tenant_id)

            # 使用 with_loader_criteria 实现全局过滤
            # 逻辑：针对所有继承自 Base 且映射了 tenant_id 的实体注入过滤条件
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    Base,
                    lambda cls: cls.tenant_id == tid_literal
                    if hasattr(cls, "tenant_id")
                    else true(),
                    include_aliases=True,
                )
            )
            # logger.debug(f"应用多租户过滤: tenant_id={tenant_id}")
