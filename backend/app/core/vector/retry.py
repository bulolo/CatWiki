# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""重试策略与熔断器

retry_on_transient: 对瞬时错误（网络抖动、服务限流）执行指数退避重试。
CircuitBreaker:      防止雪崩，连续失败达到阈值后快速失败直至恢复窗口过期。
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any, TypeVar

from app.core.vector.exceptions import VectorStoreConnectionError

logger = logging.getLogger(__name__)

_T = TypeVar("_T")


@dataclass
class RetryPolicy:
    max_attempts: int = 3
    retryable_http_statuses: frozenset[int] = field(default_factory=lambda: frozenset({429, 503}))
    base_delay: float = 0.5
    max_delay: float = 30.0
    backoff_factor: float = 2.0
    jitter: bool = True


DEFAULT_RETRY_POLICY = RetryPolicy()


async def retry_on_transient(  # noqa: UP047
    coro_factory: Callable[[], Coroutine[Any, Any, _T]],
    policy: RetryPolicy = DEFAULT_RETRY_POLICY,
    operation: str = "operation",
) -> _T:
    """Execute coro_factory with exponential-backoff retry on transient errors.

    Only retries when the exception carries an HTTP status in policy.retryable_http_statuses
    or when no HTTP status metadata is present (assumed transient network error).
    Non-retryable HTTP statuses (e.g. 401, 403) are re-raised immediately.
    """
    last_exc: BaseException | None = None
    for attempt in range(policy.max_attempts):
        try:
            return await coro_factory()
        except Exception as exc:
            last_exc = exc
            status: int | None = getattr(getattr(exc, "meta", None), "status", None)

            # If we have an explicit HTTP status and it is NOT in the retryable set, bail out.
            if status is not None and status not in policy.retryable_http_statuses:
                raise

            if attempt >= policy.max_attempts - 1:
                break

            delay = min(policy.base_delay * (policy.backoff_factor**attempt), policy.max_delay)
            if policy.jitter:
                delay *= random.uniform(0.5, 1.0)

            logger.warning(
                f"[Retry] {operation} failed (attempt {attempt + 1}/{policy.max_attempts}), "
                f"status={status}, retrying in {delay:.2f}s: {exc}"
            )
            await asyncio.sleep(delay)

    raise last_exc  # type: ignore[misc]


class CircuitBreaker:
    """Half-open circuit breaker for protecting external service calls."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        name: str = "CircuitBreaker",
    ) -> None:
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._name = name
        self._failure_count: int = 0
        self._is_open: bool = False
        self._opened_at: float = 0.0

    async def call(
        self,
        coro_factory: Callable[[], Coroutine[Any, Any, _T]],
        operation: str = "operation",
    ) -> _T:
        if self._is_open:
            elapsed = time.monotonic() - self._opened_at
            if elapsed < self._recovery_timeout:
                raise VectorStoreConnectionError(
                    f"[{self._name}] Circuit open — {self._recovery_timeout - elapsed:.1f}s "
                    f"until recovery attempt ({operation})"
                )
            # Recovery window expired: go half-open (reset and allow one attempt)
            logger.info(
                f"[{self._name}] Circuit half-open, allowing recovery attempt ({operation})"
            )
            self._is_open = False
            self._failure_count = 0

        try:
            result = await coro_factory()
            self._failure_count = 0
            return result
        except Exception as exc:
            self._failure_count += 1
            if self._failure_count >= self._failure_threshold:
                self._is_open = True
                self._opened_at = time.monotonic()
                logger.error(
                    f"[{self._name}] Circuit opened after {self._failure_count} failures "
                    f"({operation}): {exc}"
                )
            raise
