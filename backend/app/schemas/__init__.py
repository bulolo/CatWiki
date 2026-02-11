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
from app.schemas.tenant import TenantCreate, TenantSchema, TenantUpdate
from app.schemas.system_config import (
    AIConfigUpdate,
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
    "DocProcessorConfig",
    "DocProcessorsUpdate",
    "TestDocProcessorRequest",
    "SiteStats",
    "TenantCreate",
    "TenantSchema",
    "TenantUpdate",
]
