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
OpenAPI 规范过滤和处理工具
"""

from fastapi import FastAPI


# 去掉缓存，确保开发环境下能实时看到 EE 接口变更
def filter_openapi_by_prefix(app: FastAPI, prefix: str) -> dict:
    """根据路径前缀过滤 OpenAPI 规范

    Args:
        app: FastAPI 应用实例
        prefix: 路径前缀，如 "/v1" 或 "/admin/v1"

    Returns:
        过滤后的 OpenAPI 规范字典
    """
    full_spec = app.openapi()

    # 过滤路径（避免深拷贝，直接构建新字典）
    filtered_paths = {
        path: methods
        for path, methods in full_spec.get("paths", {}).items()
        if path.startswith(prefix)
    }

    # 收集相关 tags
    relevant_tags = set()
    for path, methods in filtered_paths.items():
        for method, details in methods.items():
            if isinstance(details, dict) and "tags" in details:
                relevant_tags.update(details["tags"])

    # 构建过滤后的规范
    filtered_spec = {
        "openapi": full_spec.get("openapi"),
        "info": full_spec.get("info", {}),
        "paths": filtered_paths,
        "components": full_spec.get("components", {}),
        # 改进点：不再仅仅过滤全局 tags 列表，而是确保所有在路径中用到的标签都被包含进来
        "tags": [{"name": tag} for tag in relevant_tags],
    }

    return filtered_spec
