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

"""
租户上下文管理
利用 ContextVar 实现异步请求生命周期内的租户隔离
"""

from contextlib import contextmanager
from contextvars import ContextVar

# 定义租户 ID 上下文变量，默认为 None (表示全局视角)
_tenant_context: ContextVar[int | None] = ContextVar("tenant_id", default=None)


def set_current_tenant(tenant_id: int | None) -> None:
    """
    设置当前请求的租户 ID
    通常由 FastAPI 依赖项在认证后调用
    """
    _tenant_context.set(tenant_id)


def get_current_tenant() -> int | None:
    """
    获取当前请求的租户 ID
    用于数据库拦截器或业务代码
    """
    val = _tenant_context.get()
    if val is not None:
        return val

    # 尝试加载 EE 版默认值 (例如支持平台全局视角)
    try:
        from app.core.infra.config import settings

        # 双重保险：只有配置为 enterprise 时才尝试加载 EE 逻辑
        # 这防止了即使有代码但配置错误（或被攻击者手动放置了文件）的情况
        if settings.CATWIKI_EDITION != "enterprise":
            return 1

        from app.ee.loader import get_ee_default_tenant_id

        return get_ee_default_tenant_id()
    except (ImportError, AttributeError):
        # 社区版：默认返回租户 1 (唯一租户)
        return 1


@contextmanager
def temporary_tenant_context(tenant_id: int | None):
    """
    临时切换租户上下文 (Context Manager)
    用于在特定代码块中临时使用不同的租户视角 (e.g. 访问全局配置)
    """
    token = _tenant_context.set(tenant_id)
    try:
        yield
    finally:
        _tenant_context.reset(token)
