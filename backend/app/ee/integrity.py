# Copyright 2024 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0)

import asyncio
import logging
import uuid
import httpx
import os
import platform
import socket
from datetime import datetime
from sqlalchemy import text
from app.core.infra.config import settings
from app.db.database import AsyncSessionLocal
from app.crud.system_config import crud_system_config
from app.api.admin.endpoints.system_config import SYSTEM_INTEGRITY_KEY
from app.ee.license import license_service

logger = logging.getLogger(__name__)

# Enterprise Telemetry Configuration
def _get_telemetry_url():
    """Returns the appropriate telemetry endpoint based on environment."""
    if settings.ENVIRONMENT == "prod":
        return "https://api.catwiki.ai/v1/telemetry/heartbeat"
    # For Docker on Mac/Windows, use host.docker.internal to reach telemetry-backend on port 8005
    return "http://host.docker.internal:8005/v1/telemetry/heartbeat"

class SystemIntegrityManager:
    """
    Manages system diagnostics, telemetry gathering, and license enforcement.
    This module is excluded from Community Edition releases.
    """
    
    def __init__(self):
        self.installation_id = None
        self.captured_api_host = ""
        self.captured_client_host = ""
        self.captured_admin_host = ""
        self.is_boot_ok = True

    async def initialize(self):
        """Load or create the unique installation ID."""
        async with AsyncSessionLocal() as db:
            config = await crud_system_config.get_by_key(db, config_key=SYSTEM_INTEGRITY_KEY)
            if config and config.config_value and "installation_id" in config.config_value:
                self.installation_id = config.config_value["installation_id"]
            else:
                self.installation_id = str(uuid.uuid4())
                await crud_system_config.update_by_key(
                    db,
                    config_key=SYSTEM_INTEGRITY_KEY,
                    config_value={
                        "installation_id": self.installation_id,
                        "created_at": datetime.utcnow().isoformat(),
                    },
                )
        return self.installation_id

    def capture_request_context(self, request):
        """Extrapolate deployment context from incoming request headers."""
        # Client Origin
        client_origin = request.headers.get("X-Client-Origin")
        if client_origin:
            self.captured_client_host = self._clean_host(client_origin)

        # Admin Origin
        admin_origin = request.headers.get("X-Admin-Origin")
        if admin_origin:
            self.captured_admin_host = self._clean_host(admin_origin)

        # API Host
        host = request.headers.get("Host")
        if host and not any(x in host for x in ["localhost", "127.0.0.1"]):
            self.captured_api_host = host

        # Boot State
        state = request.headers.get("X-App-State")
        if state == "0x4b4f": # "KO"
            self.is_boot_ok = False
        elif state == "0x4f4b": # "OK"
            self.is_boot_ok = True

    @staticmethod
    def _clean_host(host: str) -> str:
        if not host: return host
        if "://" in host: host = host.split("://")[1]
        if "/" in host: host = host.split("/")[0]
        return host

    async def gather_telemetry(self) -> dict:
        """Collect hardware and database metrics."""
        payload = {
            "os": platform.system(),
            "os_release": platform.release(),
            "hostname": self.captured_api_host or socket.gethostname(),
            "client_domain": self.captured_client_host,
            "admin_domain": self.captured_admin_host,
            "python_version": platform.python_version(),
            "app_version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "cpu_cores": os.cpu_count() or 0,
            "boot_ok": self.is_boot_ok,
            "license_valid": license_service.is_valid,
            "stats": {
                "tenants": 0,
                "sites": 0,
                "documents": 0
            }
        }

        # Memory Info
        try:
            import psutil
            payload["memory_gb"] = round(psutil.virtual_memory().total / (1024**3), 2)
        except ImportError:
            try:
                payload["memory_gb"] = round((os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")) / (1024**3), 2)
            except:
                payload["memory_gb"] = 0

        # Database Metrics
        try:
            async with AsyncSessionLocal() as db:
                # Optimized metrics queries
                tenants_count = await db.execute(text("SELECT COUNT(*) FROM tenants"))
                sites_count = await db.execute(text("SELECT COUNT(*) FROM sites"))
                docs_count = await db.execute(text("SELECT COUNT(*) FROM document"))
                users_count = await db.execute(text("SELECT COUNT(*) FROM users"))
                
                # Sample identifiers for verification (Mandatory Slugs)
                site_slugs = await db.execute(text("SELECT slug FROM sites LIMIT 10"))
                site_list = [r[0] for r in site_slugs.fetchall()]
                
                tenant_slugs = await db.execute(text("SELECT slug FROM tenants LIMIT 10"))
                tenant_list = [r[0] for r in tenant_slugs.fetchall()]
                
                payload["stats"] = {
                    "tenants": tenants_count.scalar() or 0,
                    "sites": sites_count.scalar() or 0,
                    "documents": docs_count.scalar() or 0,
                    "users": users_count.scalar() or 0
                }
                payload["site_identifiers"] = site_list
                payload["tenant_identifiers"] = tenant_list
        except Exception as e:
            logger.debug(f"Telemetry DB gather failed: {e}")

        return payload

    async def sync_heartbeat(self):
        """Report system state to CatWiki Central."""
        try:
            if not self.installation_id:
                await self.initialize()

            telemetry = await self.gather_telemetry()
            
            async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
                await client.post(
                    _get_telemetry_url(),
                    json={
                        "installation_id": self.installation_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "telemetry": telemetry,
                        "license_key": settings.CATWIKI_LICENSE_KEY if hasattr(settings, "CATWIKI_LICENSE_KEY") else None
                    },
                )
        except Exception as e:
            logger.debug(f"Heartbeat sync failed: {e}")

    async def monitoring_loop(self):
        """Persistent background reporting loop."""
        await asyncio.sleep(10) # Initial delay
        while True:
            await self.sync_heartbeat()
            # Default reporting interval: 12 hours
            await asyncio.sleep(43200)

_manager = SystemIntegrityManager()

async def integrity_middleware(request, call_next):
    _manager.capture_request_context(request)
    return await call_next(request)

def init_app_diagnostics(app):
    """Enable diagnostic middleware for the application."""
    app.middleware("http")(integrity_middleware)
    logger.info("⚡ Diagnostic Service enabled (EE)")

def init_background_monitoring():
    """Start the background telemetry thread."""
    asyncio.create_task(_manager.monitoring_loop())
    logger.info("⚡ System monitoring active (EE)")
