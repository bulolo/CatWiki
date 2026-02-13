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

import logging
from fastapi import FastAPI

logger = logging.getLogger(__name__)


async def init_ee_features(app: FastAPI):
    """
    Initialize Enterprise Edition features.
    This includes dynamic routing, multi-tenant filters, and middleware.
    """
    from app.core.infra.config import settings

    if settings.CATWIKI_EDITION != "enterprise":
        logger.info("🏠 CatWiki Community Edition mode active, skipping EE features.")
        return

    logger.info("⚡ Detecting CatWiki Enterprise Edition features...")

    # 1. Verify License (Enterprise Only)
    # We check license BEFORE initializing routes to prevent unauthorized access
    from app.ee.license import license_service

    is_licensed = await license_service.verify_license(settings.CATWIKI_LICENSE_KEY)

    if not is_licensed:
        logger.warning("🔒 [EE] License invalid or missing. Enterprise features are DISABLED.")
        return

    logger.info(f"✅ [EE] License verified for {license_service.info.customer}")

    # 2. Initialize EE Router
    try:
        from app.ee.api.router import init_ee_routes

        init_ee_routes(app)
        logger.info("✅ EE Routes initialized")
    except ImportError:
        logger.warning("⚠️ EE Routes not found, skipping...")

    # 3. Initialize Integrity Service
    try:
        from app.ee.integrity import init_app_diagnostics, init_background_monitoring

        init_background_monitoring()
        logger.info("✅ [EE] Integrity & Monitoring Service initialized")
    except ImportError:
        logger.warning("⚠️ [EE] Integrity Service not found, skipping...")

    pass


def get_ee_tenant_id(current_user, request) -> int | None:
    """
    Enterprise Edition logic for determining the effective tenant ID.
    Supports platform administrators switching contexts via headers.
    """
    from app.models.user import UserRole

    # 只有平台管理员支持动态切换
    if current_user.role == UserRole.ADMIN:
        header_tenant_id = request.headers.get("X-Selected-Tenant-ID")
        if header_tenant_id:
            try:
                return int(header_tenant_id)
            except ValueError:
                return None
        return None
    return current_user.tenant_id


def get_ee_object_path(path: str) -> str:
    """
    Enterprise Edition logic for file storage path isolation.
    Prefixes all paths with tenants/{tenant_id}/.
    """
    from app.core.infra.tenant import get_current_tenant

    tenant_id = get_current_tenant()
    if tenant_id:
        return f"tenants/{tenant_id}/{path.lstrip('/')}"
    return path


def get_ee_default_tenant_id() -> int | None:
    """
    Enterprise Edition default tenant ID.
    Returns None to default to Platform Global view for background tasks.
    """
    return None
