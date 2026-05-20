from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.i18n import _

RobotContextResolver = Callable[[str, int, AsyncSession], Awaitable[dict]]


@dataclass(frozen=True)
class RobotResolverMeta:
    provider: str
    resolver: RobotContextResolver
    source: str
    version: str | None
    enabled: bool


_RESOLVERS: dict[str, RobotResolverMeta] = {}


def register_robot_context_resolver(
    provider: str,
    resolver: RobotContextResolver,
    *,
    override: bool = False,
    source: str = "builtin",
    version: str | None = None,
    enabled: bool = True,
) -> None:
    if not override and provider in _RESOLVERS:
        raise ValueError(f"Resolver for provider '{provider}' already registered")
    _RESOLVERS[provider] = RobotResolverMeta(
        provider=provider,
        resolver=resolver,
        source=source,
        version=version,
        enabled=enabled,
    )


async def get_robot_context(provider: str, kind: str, site_id: int, db: AsyncSession) -> dict:
    meta = _RESOLVERS.get(provider)
    if not meta:
        raise HTTPException(status_code=500, detail=_("bot.unknown_platform"))
    if not meta.enabled:
        raise HTTPException(status_code=403, detail=_("bot.platform_not_enabled"))
    return await meta.resolver(kind, site_id, db)


def list_resolvers() -> list[RobotResolverMeta]:
    return list(_RESOLVERS.values())
