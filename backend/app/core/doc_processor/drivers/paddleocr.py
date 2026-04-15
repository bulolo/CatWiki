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

import base64
import logging
import re
from pathlib import Path

import httpx

from app.core.doc_processor.base import BaseDocProcessor, ParsedResult
from app.core.doc_processor.factory import DocProcessorFactory
from app.core.doc_processor.image_handler import ImageProcessor
from app.schemas.system_config import DocProcessorType

logger = logging.getLogger(__name__)


class PaddleOCRDocProcessor(BaseDocProcessor):
    """
    PaddleOCR 文档解析器
    基于 PaddleOCR-VL 的布局解析 API
    """

    def __init__(self, config):
        super().__init__(config)
        self.timeout = 120.0  # 大文件需要更长时间
        logger.info(f"PaddleOCRDocProcessor initialized with {config.name}")

    async def is_healthy(self) -> bool:
        """
        检查 PaddleOCR 服务健康状态
        PaddleOCR health API 返回格式:
        {
            "logId": "xxx",
            "errorCode": 0,
            "errorMsg": "Healthy"
        }
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/health")
                if resp.status_code != 200:
                    return False
                data = resp.json()
                return data.get("errorCode") == 0
        except Exception as e:
            logger.warning(f"PaddleOCR health check failed: {e}")
            return False

    async def process(self, file_path: Path, **kwargs) -> ParsedResult:
        """
        调用 PaddleOCR /layout-parsing API 解析文档

        API 参考:
        POST /layout-parsing
        Request: {
            "file": "<base64_encoded_file>",
            "fileType": 0 (PDF) | 1 (Image),
            ...
        }
        Response: {
            "logId": "xxx",
            "errorCode": 0,
            "errorMsg": "Success",
            "result": {
                "layoutParsingResults": [{
                    "markdown": {"text": "...", "images": {...}},
                    "outputImages": {...}
                }],
                "dataInfo": {...}
            }
        }
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # 读取文件并转为 base64
        with open(file_path, "rb") as f:
            file_content = base64.b64encode(f.read()).decode("utf-8")

        # 判断文件类型: 0=PDF, 1=Image
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            file_type = 0
        else:
            file_type = 1  # 图片类型

        # 获取配置
        processor_config = self.config.model_dump().get("config", {}) or {}
        extract_images = kwargs.get("extract_images", processor_config.get("extract_images", False))
        extract_tables = kwargs.get("extract_tables", processor_config.get("extract_tables", True))

        # 构建请求体
        request_body = {
            "file": file_content,
            "fileType": file_type,
            "useLayoutDetection": True,
            "prettifyMarkdown": True,
            "mergeTables": extract_tables,
            "relevelTitles": True,
        }

        # 合并自定义配置
        for key, value in processor_config.items():
            if key not in ["is_ocr", "extract_images", "extract_tables"]:
                request_body[key] = value

        url = f"{self.base_url}/layout-parsing"
        logger.info(f"PaddleOCR processing: {file_path.name}, fileType={file_type}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=request_body)

                if resp.status_code != 200:
                    error_msg = f"PaddleOCR API Error ({resp.status_code}): {resp.text}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                result = resp.json()

                # 检查 errorCode
                if result.get("errorCode") != 0:
                    error_msg = f"PaddleOCR Error: {result.get('errorMsg', 'Unknown error')}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                # 提取解析结果
                markdown_content = ""
                all_images = {}

                layout_results = result.get("result", {}).get("layoutParsingResults", [])
                for page_result in layout_results:
                    markdown_data = page_result.get("markdown", {})
                    page_text = markdown_data.get("text", "")
                    if page_text:
                        markdown_content += page_text + "\n\n"

                    # 收集图片 (base64 格式)
                    page_images = markdown_data.get("images", {})
                    if page_images:
                        all_images.update(page_images)

                    output_images = page_result.get("outputImages", {})
                    if output_images:
                        all_images.update(output_images)

                markdown_content = markdown_content.strip()

                logger.info(
                    f"PaddleOCR collected {len(all_images)} images, extract_images={extract_images}"
                )
                if all_images:
                    logger.info(f"PaddleOCR image keys: {list(all_images.keys())[:5]}")

                # 处理图片 (上传到 RustFS 并替换链接)
                if markdown_content and all_images and extract_images:
                    try:
                        image_processor = ImageProcessor()
                        markdown_content = await image_processor.process_paddleocr_content(
                            markdown_content, all_images
                        )
                    except Exception as e:
                        logger.error(f"Image processing failed: {e}")
                elif markdown_content and not extract_images:
                    # 清理未处理的图片引用，避免死链
                    # 移除 HTML <img> 标签 (PaddleOCR 格式)
                    markdown_content = re.sub(
                        r'<img\s+[^>]*src=["\']imgs/[^"\']*["\'][^>]*/?\s*>', "", markdown_content
                    )
                    # 移除 Markdown 图片语法
                    markdown_content = re.sub(r"!\[[^\]]*\]\(imgs/[^)]+\)", "", markdown_content)

                return ParsedResult(
                    content=markdown_content,
                    markdown=markdown_content,
                    images=[],
                    metadata={
                        "dataInfo": result.get("result", {}).get("dataInfo", {}),
                        "logId": result.get("logId"),
                    },
                )

        except Exception as e:
            logger.error(f"PaddleOCR process failed: {e}", exc_info=True)
            raise


# 注册 PaddleOCR
DocProcessorFactory.register(DocProcessorType.PADDLEOCR, PaddleOCRDocProcessor)
