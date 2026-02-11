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
租户上下文管理
利用 ContextVar 实现异步请求生命周期内的租户隔离
"""

from contextvars import ContextVar
from typing import Optional

# 定义租户 ID 上下文变量，默认为 None (表示全局视角)
_tenant_context: ContextVar[Optional[int]] = ContextVar("tenant_id", default=None)


def set_current_tenant(tenant_id: Optional[int]) -> None:
    """
    设置当前请求的租户 ID
    通常由 FastAPI 依赖项在认证后调用
    """
    _tenant_context.set(tenant_id)


def get_current_tenant() -> Optional[int]:
    """
    获取当前请求的租户 ID
    用于数据库拦截器或业务代码
    """
    return _tenant_context.get()


from contextlib import contextmanager


@contextmanager
def temporary_tenant_context(tenant_id: Optional[int]):
    """
    临时切换租户上下文 (Context Manager)
    用于在特定代码块中临时使用不同的租户视角 (e.g. 访问全局配置)
    """
    token = _tenant_context.set(tenant_id)
    try:
        yield
    finally:
        _tenant_context.reset(token)
