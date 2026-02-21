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

"""
Pydantic Schemas

为了减少耦合，请尽量直接从子模块导入所需的 Schema。
此文件仅 re-export 最核心的基础类型。
"""

from app.schemas.base import BaseSchema, BaseSchemaWithTimestamps
from app.schemas.response import (
    ApiResponse,
    ApiResponseModel,
    HealthResponse,
    PaginatedResponse,
    PaginationInfo,
    Response,  # 向后兼容别名
)

__all__ = [
    "BaseSchema",
    "BaseSchemaWithTimestamps",
    "ApiResponse",
    "ApiResponseModel",
    "PaginationInfo",
    "PaginatedResponse",
    "HealthResponse",
    "Response",
]
