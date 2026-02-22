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


class MinerUDocProcessor(BaseDocProcessor):
    """
    MinerU (Magic-PDF) 文档解析器
    """

    def __init__(self, config):
        super().__init__(config)
        self.timeout = 120.0  # Increase timeout for large files
        logger.info(f"MinerUDocProcessor initialized (v3) with {config.name}")

    async def check_health(self) -> bool:
        """
        MinerU 没有标准的 /health 接口，通常使用 /openapi.json 检查服务存活
        或者尝试访问根路径
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 尝试访问 openapi.json
                resp = await client.get(f"{self.base_url}/openapi.json")
                if resp.status_code == 200:
                    return True

                # 回退：尝试访问根路径 (通常是重定向到 /docs)
                resp = await client.get(f"{self.base_url}/")
                # 200 OK 或 404 Not Found (服务活着但根路径无内容) 都视为存活
                # 只要不是 Connection Refused
                return True
        except Exception as e:
            logger.warning(f"MinerU health check failed: {e}")
            return False

    async def process(self, file_path: Path, **kwargs) -> ParsedResult:
        """
        调用 MinerU API 解析文档

        API 参考:
        POST /file_parse
        Parameters:
          files: array of binary
          parse_method: auto | ocr | txt
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # 获取配置
        processor_config = self.config.model_dump().get("config", {}) or {}

        # 提取通用配置并映射到 Mineru 参数
        # 1. OCR (默认为 True/ocr)
        is_ocr = processor_config.get("is_ocr", True)
        # 2. 图片 (默认为 False)
        extract_images = processor_config.get("extract_images", False)

        # Mineru 参数映射
        # parse_method: ocr (强制OCR) | auto (自动)
        parse_method = "ocr" if is_ocr else "auto"

        url = f"{self.base_url}/file_parse"

        logger.info(
            f"MinerU processing: {file_path.name}, Method={parse_method}, Images={extract_images}"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                with open(file_path, "rb") as f:
                    # files 字段期望是数组
                    files = {"files": (file_path.name, f, "application/pdf")}

                    data = {
                        "parse_method": parse_method,
                        "return_md": "true",
                        "return_images": "true" if extract_images else "false",
                    }

                    # 合并其他自定义配置
                    data.update(
                        {
                            k: v
                            for k, v in processor_config.items()
                            if k not in ["is_ocr", "extract_images", "extract_tables"]
                        }
                    )

                    resp = await client.post(url, files=files, data=data)

                    if resp.status_code != 200:
                        error_msg = f"MinerU API Error ({resp.status_code}): {resp.text}"
                        logger.error(error_msg)
                        raise ValueError(error_msg)

                    result = resp.json()

                    # MinerU 实际返回格式 (based on logs):
                    # {
                    #   "results": {
                    #     "hash_id": { "md_content": "...", "images": {} }
                    #   }
                    # }
                    markdown_content = ""
                    images = []

                    if "results" in result and isinstance(result["results"], dict):
                        for key, val in result["results"].items():
                            if isinstance(val, dict):
                                content = (
                                    val.get("md_content")
                                    or val.get("markdown")
                                    or val.get("content")
                                )
                                if content:
                                    markdown_content = content
                                    # 如果有多个文件，暂只取第一个有效内容
                                    images = val.get("images", [])
                                    break

                    # Fallback strategies
                    if not markdown_content:
                        markdown_content = (
                            result.get("markdown")
                            or result.get("content")
                            or result.get("md_content")
                            or ""
                        )

                    if not markdown_content:
                        logger.warning(f"MinerU response empty content: {result}")

                    # 处理图片 (上传到 RustFS 并替换链接)
                    if markdown_content and isinstance(images, dict) and extract_images:
                        try:
                            image_processor = ImageProcessor()
                            markdown_content = await image_processor.process_mineru_content(
                                markdown_content, images
                            )
                            # 图片已处理并嵌入 Markdown，这里清空 images 列表或仅保留作为元数据
                            # 为了保持一致性，我们不再返回原始 base64 数据
                            images = []
                        except Exception as e:
                            logger.error(f"Image processing failed: {e}")
                    elif markdown_content and not extract_images:
                        # 清理未处理的图片引用，避免死链
                        import re

                        # 移除 Markdown 图片语法
                        markdown_content = re.sub(
                            r"!\[[^\]]*\]\(images/[^)]+\)", "", markdown_content
                        )
                        # 移除 HTML <img> 标签
                        markdown_content = re.sub(
                            r'<img\s+[^>]*src=["\']images/[^"\']*["\'][^>]*/?\s*>',
                            "",
                            markdown_content,
                        )

                    return ParsedResult(
                        content=markdown_content,
                        markdown=markdown_content,
                        images=images if isinstance(images, list) else [],
                        metadata=result.get("metadata", {}),
                    )

        except httpx.TimeoutException:
            raise TimeoutError("MinerU request timed out")
        except Exception as e:
            logger.error(f"MinerU process failed: {e}", exc_info=True)
            raise e


# 注册 MinerU
DocProcessorFactory.register(DocProcessorType.MINERU, MinerUDocProcessor)
