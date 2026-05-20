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

"""AI Provider 基类与解析结果类型。

把 chat / embedding / rerank 三家共有的「读配置 → 命中缓存 / 构造实例 →
打 usage signal → 返回」四步抽到一处。子类只需实现 ``_fetch_config`` 与
``_build_instance``，其余统一在 ``resolve()`` 里完成。

收益：
- 缓存写入走 ``asyncio.Lock`` + double-check，消除冷启动同租户并发构造的竞态。
- HIT / MISS 日志只在一处发出，子类不再各自重复。
- 元数据通过 ``Resolved[T]`` 显式回传，调用方不必嗅探私有属性或 ContextVar。
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class Resolved(Generic[T]):
    """Provider 解析结果：运行时对象 + 它的身份元数据。

    `instance`：实际可用的 chat / embedding / rerank-config 对象。
    `model` / `hash`：用于日志、统计、debug 卡片。
    `tenant_id`：解析时使用的租户上下文（来自调用方或当前 ContextVar）。
    `extra`：观测扩展字段（Provider / Base URL / Temperature 等）。
    """

    instance: T
    model: str
    hash: str
    tenant_id: int | None
    extra: dict[str, Any] = field(default_factory=dict)


class BaseAIProvider(ABC, Generic[T]):
    """三家 provider 的共有形态。

    子类约定（必填）：
    - 类属性 ``section_name``：日志 / 配置 section 名，例如 ``"chat"``。
    - ``_fetch_config(tenant_id, *, force)``：经 configuration_service 拿当前
      租户的最终配置 dict。
    - ``_build_instance(conf, **override)``：基于配置造一个真正的 provider 对象。

    子类约定（选填，按需覆盖）：
    - ``_cache_key(conf, **override)``：默认按 ``conf["_hash"]`` 缓存。chat 需要
      把 model / temperature 等运行时参数纳入键。
    - ``_signal_extras(conf, **override)``：默认输出 Provider / Base URL / Source；
      chat 会再叠加 Temperature，embedding 叠加 Dimension。

    并发安全：缓存读为无锁快路径，未命中时走 ``asyncio.Lock`` + double-check，
    避免同租户冷启动并发请求重复构造多余实例。
    """

    section_name: str = ""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._cache: dict[str, T] = {}

    async def resolve(
        self,
        tenant_id: int | None = None,
        *,
        force: bool = False,
        purpose: str | None = None,
        emit_signal: bool = True,
        **override: Any,
    ) -> Resolved[T]:
        """读配置 → 命中或构造 → 打 signal → 返回 Resolved[T]。

        force=True 透传给 ``configuration_service``，绕过上层 60s 缓存重新拉取，
        并强制重新构造 instance（适配凭证轮换 / 管理后台改配置后立即生效）。

        emit_signal=False 用于纯探测（如 ``Reranker.is_enabled``），不希望把单纯
        的可用性查询计入 usage 卡片。
        """
        conf = await self._fetch_config(tenant_id, force=force)
        key = self._cache_key(conf, **override)
        model = conf.get("model", "N/A")
        h = conf.get("_hash", "")
        extras = self._signal_extras(conf, **override)

        # 快路径：缓存命中，不持锁
        if not force and key in self._cache:
            if emit_signal:
                self._emit_signal(model, h, True, tenant_id, extras, purpose)
            return Resolved(self._cache[key], model, h, tenant_id, extras)

        # 慢路径：上锁 + double-check，确保同 key 只构造一次
        async with self._lock:
            if not force and key in self._cache:
                if emit_signal:
                    self._emit_signal(model, h, True, tenant_id, extras, purpose)
                return Resolved(self._cache[key], model, h, tenant_id, extras)

            inst = await self._build_instance(conf, **override)
            self._cache[key] = inst
            if emit_signal:
                self._emit_signal(model, h, False, tenant_id, extras, purpose)
            return Resolved(inst, model, h, tenant_id, extras)

    def _emit_signal(
        self,
        model: str,
        h: str,
        is_hit: bool,
        tenant_id: int | None,
        extras: dict[str, Any],
        purpose: str | None,
    ) -> None:
        # 延迟 import 避免 base 层反向依赖业务 utils
        from app.core.common.ai_logging import log_ai_usage_signal

        log_ai_usage_signal(
            self.section_name,
            model,
            h,
            is_hit=is_hit,
            tenant_id=tenant_id,
            extra=extras,
            purpose=purpose,
        )

    @abstractmethod
    async def _fetch_config(self, tenant_id: int | None, *, force: bool) -> dict[str, Any]:
        """子类实现：把租户上下文映射到 configuration_service.get_*_config。"""

    @abstractmethod
    async def _build_instance(self, conf: dict[str, Any], **override: Any) -> T:
        """子类实现：把配置 dict 转成真正的运行时对象。

        ``override`` 是 ``resolve()`` 接到的运行时覆盖参数（如 chat 的 model /
        temperature 选项），子类自己挑出有意义的字段使用。
        """

    def _cache_key(self, conf: dict[str, Any], **override: Any) -> str:
        """默认按配置指纹缓存；运行时参数会改变行为时由子类覆盖。"""
        return conf.get("_hash") or ""

    def _signal_extras(self, conf: dict[str, Any], **override: Any) -> dict[str, Any]:
        """默认 usage 信号扩展字段。子类追加 Temperature / Dimension 等。"""
        return {
            "Provider": conf.get("provider", "N/A"),
            "Base URL": conf.get("base_url", "N/A"),
            "Source": conf.get("_source", "platform"),
        }

    async def aclose(self) -> None:
        """关闭并清空缓存。子类持有外部资源时应覆盖（如 Reranker 的 httpx 客户端）。"""
        self._cache.clear()
