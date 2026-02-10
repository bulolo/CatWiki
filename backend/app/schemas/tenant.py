from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class TenantBase(BaseModel):
    name: str
    slug: str
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    status: str = "trial"
    max_sites: int = 3
    max_documents: int = 1000
    max_storage_mb: int = 5120
    max_users: int = 10
    plan: str = "starter"
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None


class TenantCreate(TenantBase):
    plan_expires_at: datetime


class TenantUpdate(TenantBase):
    name: Optional[str] = None
    slug: Optional[str] = None
    plan_expires_at: Optional[datetime] = None


class TenantInDBBase(TenantBase):
    id: int
    created_at: datetime
    updated_at: datetime
    plan_expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TenantSchema(TenantInDBBase):
    pass
