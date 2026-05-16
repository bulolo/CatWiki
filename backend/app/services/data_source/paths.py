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

"""数据源路径计算（纯函数，无副作用）"""


def get_internal_root_prefix(config: dict) -> str:
    """
    构造内置数据源的实际根路径前缀。

    EE 模式下自动加 `{tenant_slug 或 tenant_id}/` 隔离，
    CE 模式下直接使用用户指定的 root_prefix。

    返回的字符串可能含或不含尾斜杠，调用方需视场景处理。
    """
    user_prefix = (config or {}).get("root_prefix", "")
    try:
        from app.ee.loader import get_ee_object_path

        # get_ee_object_path("") 在 EE 下返回 "{slug}/"，CE 下导入失败
        base = get_ee_object_path("")
    except (ImportError, AttributeError):
        return user_prefix

    if not base:
        return user_prefix
    if user_prefix:
        return base.rstrip("/") + "/" + user_prefix.lstrip("/")
    return base


def compute_browse_prefix(base: str, prefix: str) -> str:
    """
    计算 S3/RustFS list_objects 的查询 prefix。

    约定：
    - prefix 为空：用 `base/` 作为根目录查询
    - prefix 已是完整路径（来自 item.path）：原样使用
    - prefix 是相对路径：拼接到 base 下
    """
    base_norm = base.rstrip("/")
    if not prefix:
        return f"{base_norm}/" if base_norm else ""
    if base_norm and (prefix == base_norm or prefix.startswith(base_norm + "/")):
        return prefix
    if base_norm:
        return f"{base_norm}/{prefix.lstrip('/')}"
    return prefix


def is_within_base(key: str, base: str) -> bool:
    """判断 key 是否落在 base 的范围内（用于上传/删除越权校验）"""
    base_norm = base.rstrip("/")
    if not base_norm:
        return True
    return key.startswith(base_norm + "/")
