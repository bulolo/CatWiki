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

import logging
from pathlib import Path

import httpx

from app.core.doc_processor.base import BaseDocProcessor, ParsedResult
from app.core.doc_processor.factory import DocProcessorFactory
from app.core.doc_processor.image_handler import ImageProcessor
from app.schemas.system_config import DocProcessorType

logger = logging.getLogger(__name__)


class DoclingDocProcessor(BaseDocProcessor):
    """
    Docling 文档解析器
    """

    async def check_health(self) -> bool:
        headers = {}
        if self.api_key:
            # OpenAPI defined security: {'APIKeyAuth': {'type': 'apiKey', 'in': 'header', 'name': 'X-Api-Key'}}
            headers["X-Api-Key"] = self.api_key

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/health", headers=headers)
                return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Docling health check failed: {e}")
            return False

    async def process(self, file_path: Path, **kwargs) -> ParsedResult:
        """
        调用 Docling API 解析文档

        API 参考:
        POST /v1/convert/file
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        url = f"{self.base_url}/v1/convert/file"

        # 获取系统配置
        system_config = self.config.model_dump().get("config", {}) or {}

        # 提取通用配置并映射到 Docling 参数
        # 1. OCR (默认为 True)
        is_ocr = system_config.get("is_ocr", True)
        # 2. 表格 (默认为 True)
        extract_tables = system_config.get("extract_tables", True)
        # 3. 图片 (默认为 False)
        extract_images = system_config.get("extract_images", False)

        # 默认配置 (来源于用户提供的最佳实践)
        default_options = {
            "from_formats": [
                "docx",
                "pptx",
                "html",
                "image",
                "pdf",
                "asciidoc",
                "md",
                "csv",
                "xlsx",
                "xml_uspto",
                "xml_jats",
                "mets_gbs",
                "json_docling",
                "audio",
                "vtt",
            ],
            "to_formats": ["md"],
            "image_export_mode": "embedded" if extract_images else "placeholder",
            "do_ocr": is_ocr,
            "force_ocr": False,
            "ocr_engine": "rapidocr",
            "pdf_backend": "dlparse_v4",
            "table_mode": "accurate",
            "table_cell_matching": True,
            "pipeline": "standard",
            # "page_range": [1, 9223372036854776000],
            "document_timeout": 604800,
            "abort_on_error": False,
            "do_table_structure": extract_tables,
            "include_images": extract_images,
            "images_scale": 2.0,
            "md_page_break_placeholder": "",
            "do_code_enrichment": False,
            "do_formula_enrichment": False,
            "do_picture_classification": False,
            "do_picture_description": False,
            "picture_description_area_threshold": 0.05,
        }

        # 合并配置
        final_options = default_options.copy()
        final_options.update(system_config)

        # 确保通用参数的高优先级映射 (如果 config 里同时传了 is_ocr 和 do_ocr，我们以 is_ocr 为准同步更新 do_ocr)
        if "is_ocr" in system_config:
            final_options["do_ocr"] = system_config["is_ocr"]
        if "extract_tables" in system_config:
            final_options["do_table_structure"] = system_config["extract_tables"]
        if "extract_images" in system_config:
            final_options["include_images"] = system_config["extract_images"]

        # 数据转换：将 bool 和数值转换为字符串，适应 multipart/form-data
        data = {}
        for k, v in final_options.items():
            if isinstance(v, bool):
                data[k] = "true" if v else "false"
            elif isinstance(v, (int, float)):
                data[k] = str(v)
            elif v is None:
                continue
            else:
                data[k] = v

        headers = {}
        if self.api_key:
            headers["X-Api-Key"] = self.api_key

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                with open(file_path, "rb") as f:
                    # 保持 files key 为 "files"
                    files_param = [("files", (file_path.name, f, "application/octet-stream"))]

                    resp = await client.post(url, files=files_param, data=data, headers=headers)

                    if resp.status_code != 200:
                        error_msg = f"Docling API Error ({resp.status_code}): {resp.text}"
                        logger.error(error_msg)
                        raise ValueError(error_msg)

                    result = resp.json()

                    doc = result.get("document", {})
                    markdown = doc.get("md_content") or ""

                    # 处理图片 (Base64 -> RustFS URL)
                    if markdown:
                        try:
                            image_processor = ImageProcessor()
                            markdown = await image_processor.process_docling_content(markdown)
                        except Exception as e:
                            logger.error(f"Image processing failed: {e}")

                    return ParsedResult(
                        content=markdown,
                        markdown=markdown,
                        images=[],
                        metadata=doc.get("json_content") or {},
                    )

        except httpx.TimeoutException:
            raise TimeoutError("Docling request timed out")
        except Exception as e:
            logger.error(f"Docling process failed: {e}", exc_info=True)
            raise e


# 注册 Docling
DocProcessorFactory.register(DocProcessorType.DOCLING, DoclingDocProcessor)
