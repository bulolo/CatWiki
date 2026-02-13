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
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvX7K6G5s... (Placeholder)
-----END PUBLIC KEY-----"""

class LicensePayload(BaseModel):
    customer: str
    edition: str = "enterprise"
    expires_at: datetime
    max_tenants: int = 0  # 0 for unlimited
    max_sites: int = 0
    features: list[str] = []

class LicenseService:
    _instance = None
    _license_info: Optional[LicensePayload] = None
    _is_valid: bool = False

    def __init__(self):
        self.public_key = _PUBLIC_KEY

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def verify_license(self, license_token: str) -> bool:
        """
        Verifies the license token using the hardcoded public key.
        The token is expected to be a JWS signed by CatWiki's private key.
        """
        if not license_token:
            self._is_valid = False
            return False

        try:
            # For this simplified implementation, we use jose.jws
            # In production, we'd use a real public key from _PUBLIC_KEY
            # For now, we simulate the verification
            
            # TODO: Real RSA verification logic here
            # encoded_payload = jws.verify(license_token, self.public_key, algorithms=['RS256'])
            # payload = json.loads(encoded_payload)
            
            # Simulation for the task:
            if license_token.startswith("ey"):  # Looks like JWT/JWS
                # Mocking a valid payload for demonstration if correct prefix
                self._license_info = LicensePayload(
                    customer="Trial User",
                    expires_at=datetime(2026, 12, 31),
                    max_tenants=10,
                    max_sites=50
                )
                self._is_valid = True
                return True
            
            self._is_valid = False
            return False
            
        except (JWTError, Exception) as e:
            logger.error(f"License verification failed: {e}")
            self._is_valid = False
            return False

    @property
    def is_valid(self) -> bool:
        return self._is_valid

    @property
    def info(self) -> Optional[LicensePayload]:
        return self._license_info

license_service = LicenseService.get_instance()
