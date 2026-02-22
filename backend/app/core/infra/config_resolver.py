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

import copy
import hashlib
import json
import logging
from typing import Any

from app.core.infra.tenant import temporary_tenant_context
from app.crud.system_config import crud_system_config
from app.db.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

AI_CONFIG_KEY = "ai_config"


class ConfigResolver:
    """Core configuration resolver logic.

    This class handles the retrieval and resolution of configurations from the database,
    supporting tenant-specific overrides and platform fallbacks.
    It is placed in the core layer to avoid circular dependencies.
    """

    @staticmethod
    def compute_config_hash(config: dict[str, Any]) -> str:
        """Compute Identity Hash for a configuration block."""
        identity_parts = {
            "model": config.get("model"),
            "apiKey": config.get("apiKey"),
            "baseUrl": str(config.get("baseUrl", "")).rstrip("/"),
            "dimension": config.get("dimension"),
        }
        identity_str = json.dumps(identity_parts, sort_keys=True)
        return hashlib.md5(identity_str.encode()).hexdigest()

    @staticmethod
    async def get_raw_db_config(tenant_id: int | None = None) -> dict[str, Any]:
        """Fetch raw AI configuration from database without caching."""
        async with AsyncSessionLocal() as db:
            try:
                with temporary_tenant_context(tenant_id):
                    config = await crud_system_config.get_by_key(
                        db, config_key=AI_CONFIG_KEY, tenant_id=tenant_id
                    )
                return config.config_value if config and config.config_value else {}
            except Exception as e:
                logger.error(f"❌ [ConfigResolver] DB read error (Tenant: {tenant_id}): {e}")
                return {}

    @classmethod
    async def resolve_section(cls, section: str, tenant_id: int | None = None) -> dict[str, Any]:
        """Resolve a specific configuration section (e.g., 'chat', 'embedding')."""
        # 1. Tenant Level
        if tenant_id:
            from app.core.web.exceptions import CatWikiError
            from app.crud.tenant import crud_tenant

            async with AsyncSessionLocal() as db:
                tenant = await crud_tenant.get(db, id=tenant_id)
                if not tenant:
                    raise CatWikiError(f"Tenant {tenant_id} not found")
                allowed_resources = tenant.platform_resources_allowed or []

            raw_tenant = await cls.get_raw_db_config(tenant_id)
            tenant_section = copy.deepcopy(raw_tenant.get(section))

            if tenant_section is not None:
                mode = tenant_section.get("mode")
                if mode == "custom":
                    tenant_section.update({"_mode": "custom", "_source": "tenant"})
                    tenant_section["_hash"] = cls.compute_config_hash(tenant_section)
                    return tenant_section

                if mode == "platform":
                    if "models" not in allowed_resources:
                        raise CatWikiError(
                            f"Tenant {tenant_id} attempted to use platform models without 'models' authorization"
                        )
                    # Proceed to platform resolution
                else:
                    raise CatWikiError(f"Invalid config mode for tenant {tenant_id}: {mode}")
            else:
                raise CatWikiError(
                    f"Tenant {tenant_id} has no '{section}' config and implicit fallback is disabled"
                )

        # 2. Platform Level
        raw_platform = await cls.get_raw_db_config(None)
        platform_section = copy.deepcopy(raw_platform.get(section))

        if platform_section is None:
            from app.core.web.exceptions import CatWikiError

            raise CatWikiError(f"Missing '{section}' module definition in platform config")

        platform_section.update({"_mode": "platform", "_source": "platform"})
        platform_section["_hash"] = cls.compute_config_hash(platform_section)
        return platform_section
