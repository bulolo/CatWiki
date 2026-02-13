# Copyright 2024 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0)

import json
import base64
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel
from jose import jws, JWTError
from app.core.infra.config import settings

logger = logging.getLogger(__name__)

# CatWiki Public Key for License Verification
# In a real scenario, this would be a professional 2048-bit RSA public key.
_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqd5hUoxnXiDCPwItlUue
3WCoPfSLDZ4MiNhA42k2pzx3D4Sw8gOaReBIegeM9ynN6uJKm2ohs4FMxo958mHo
oSDtQaPjYcyESIOPainXQEqeU4bKkMGd7lCZX1deM9Y0ASUqqmv0CLdzV1sALiFp
i/sFN3U3zr4hkEZ+Q/h0dyCZIeH/XYtTHDSsH9MJg6v5dYnyQAEzLFH8QYHMBv8e
dPukT26EArGRrGNC+HLr/S2QtVnSNvrlRrwfT3B2rxombmkcerNfhTrTtvfRJXv4
XeVo+CqkC1ERWyAi5FeO+mAhbPuEU+4pkElSS+KOLvDmvy9QtvHBSCH+bG1Ra9go
2wIDAQAB
-----END PUBLIC KEY-----"""


class LicensePayload(BaseModel):
    customer: str
    edition: str = "enterprise"
    expires_at: datetime
    installation_id: Optional[str] = None  # Hardware Binding
    max_tenants: int = 0  # 0 for unlimited
    max_sites: int = 0
    features: list[str] = []


class LicenseService:
    _instance = None
    _license_info: Optional[LicensePayload] = None
    _license_key: Optional[str] = None
    _is_valid: bool = False

    def __init__(self):
        self.public_key = _PUBLIC_KEY

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def verify_license(self, license_token: str) -> bool:
        """
        Verifies the license token using the hardcoded public key.
        The token is expected to be a JWS signed by CatWiki's private key.
        """
        if not license_token:
            self._is_valid = False
            self._license_key = None
            return False

        try:
            # Using JWS (JSON Web Signature) for secure offline verification
            # In production, ensure _PUBLIC_KEY is a valid RSA public key
            payload_json = jws.verify(license_token, self.public_key, algorithms=["RS256"])
            data = json.loads(payload_json)

            # 1. Parse Payload
            payload = LicensePayload(**data)

            # 2. Check Expiration
            if payload.expires_at < datetime.utcnow():
                logger.error(f"License expired at {payload.expires_at}")
                self._is_valid = False
                return False

            # 3. Check Hardware Binding (Installation ID)
            if payload.installation_id:
                from app.ee.integrity import _manager

                target_id = await _manager.initialize()
                if payload.installation_id != target_id:
                    logger.error(
                        f"License bound to {payload.installation_id}, but current system is {target_id}"
                    )
                    self._is_valid = False
                    return False

            # 4. Store info
            self._license_info = payload
            self._license_key = license_token
            self._is_valid = True
            return True

        except JWTError as e:
            logger.error(f"License signature verification failed: {e}")
            self._is_valid = False
            return False
        except Exception as e:
            logger.error(f"Unexpected error during license verification: {e}")
            self._is_valid = False
            return False

    @property
    def is_valid(self) -> bool:
        return self._is_valid

    @property
    def info(self) -> Optional[LicensePayload]:
        return self._license_info

    @property
    def license_key(self) -> Optional[str]:
        return self._license_key


license_service = LicenseService.get_instance()
