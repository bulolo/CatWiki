# 导入所有 schemas
from app.schemas.base import BaseSchema, BaseSchemaWithTimestamps
from app.schemas.collection import (
    Collection,
    CollectionCreate,
    CollectionTree,
    CollectionUpdate,
    MoveCollectionRequest,
)
from app.schemas.document import Document, DocumentCreate, DocumentUpdate
from app.schemas.response import (
    ApiResponse,
    ApiResponseModel,
    HealthResponse,
    PaginatedResponse,
    PaginationInfo,
    Response,  # 向后兼容别名
)
from app.schemas.site import Site, SiteCreate, SiteUpdate
from app.schemas.stats import SiteStats
from app.schemas.system_config import (
    AIConfigUpdate,
    BotConfigUpdate,
    DocProcessorConfig,
    DocProcessorsUpdate,
    SystemConfigCreate,
    SystemConfigResponse,
    SystemConfigUpdate,
    TestDocProcessorRequest,
)

__all__ = [
    "BaseSchema",
    "BaseSchemaWithTimestamps",
    "ApiResponse",
    "ApiResponseModel",
    "PaginationInfo",
    "PaginatedResponse",
    "HealthResponse",
    "Response",  # 向后兼容
    "Site",
    "SiteCreate",
    "SiteUpdate",
    "Collection",
    "CollectionCreate",
    "CollectionUpdate",
    "CollectionTree",
    "MoveCollectionRequest",
    "Document",
    "DocumentCreate",
    "DocumentUpdate",
    "SystemConfigCreate",
    "SystemConfigUpdate",
    "SystemConfigResponse",
    "AIConfigUpdate",
    "BotConfigUpdate",
    "DocProcessorConfig",
    "DocProcessorsUpdate",
    "TestDocProcessorRequest",
    "SiteStats",
]

