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

"""数据源相关常量与辅助判断"""

from pathlib import Path

# 不需要外部解析器、可直接以原文入库的扩展名
NATIVE_TEXT_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".md",
        ".markdown",
        ".mdx",
        ".txt",
    }
)

# 浏览/导入时识别为"可入库文件"的扩展名集合
SUPPORTED_IMPORT_EXTENSIONS: frozenset[str] = (
    frozenset(
        {
            ".pdf",
            ".docx",
            ".doc",
            ".pptx",
            ".ppt",
            ".xlsx",
            ".xls",
            ".html",
            ".htm",
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".tiff",
        }
    )
    | NATIVE_TEXT_EXTENSIONS
)


def is_supported_for_import(filename: str) -> bool:
    """判断文件名是否属于支持的导入格式"""
    return Path(filename).suffix.lower() in SUPPORTED_IMPORT_EXTENSIONS


def is_native_text(filename: str) -> bool:
    """判断文件名是否属于可直读（无需解析器）的纯文本格式"""
    return Path(filename).suffix.lower() in NATIVE_TEXT_EXTENSIONS
