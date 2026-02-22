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

from sqlalchemy import event, literal, true
from sqlalchemy.orm import Session, with_loader_criteria

from app.core.infra.tenant import get_current_tenant
from app.db.base import Base


def register_core_db_events():
    """
    Register core database events.
    In Community Edition, this handles basic tenant_id population and filtration (defaulting to 1).
    """

    @event.listens_for(Session, "do_orm_execute")
    def apply_tenant_filter(execute_state):
        """
        在 ORM 执行前拦截并注入 tenant_id 过滤条件
        """
        tenant_id = get_current_tenant()
        if tenant_id is not None:
            tid_literal = literal(tenant_id)
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    Base,
                    lambda cls: cls.tenant_id == tid_literal
                    if hasattr(cls, "tenant_id")
                    else true(),
                    include_aliases=True,
                )
            )
        return

    @event.listens_for(Base, "before_insert", propagate=True)
    def apply_tenant_on_insert(mapper, connection, target):
        """
        在数据入库前自动填充 tenant_id
        """
        if hasattr(target, "tenant_id") and getattr(target, "tenant_id") is None:
            tenant_id = get_current_tenant()  # In OSS, this returns 1
            if tenant_id is not None:
                setattr(target, "tenant_id", tenant_id)
