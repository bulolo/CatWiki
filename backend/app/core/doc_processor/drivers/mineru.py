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

import asyncio
import logging
import re
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

    async def is_healthy(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/health")
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("status") == "healthy"
                return False
        except Exception as e:
            logger.warning(f"MinerU health check failed: {e}")
            return False

    async def get_version(self) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/health")
                if resp.status_code == 200:
                    return resp.json().get("version")
        except Exception:
            pass
        return None

    async def process(self, file_path: Path, **kwargs) -> ParsedResult:
        """
        调用 MinerU API 解析文档（异步提交+轮询）

        API 参考:
        POST /tasks              -> 提交任务，返回 task_id (202)
        GET  /tasks/{task_id}    -> 轮询状态
        GET  /tasks/{task_id}/result -> 获取结果
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # 获取配置
        processor_config = self.config.model_dump().get("config", {}) or {}

        # kwargs 里的值优先级高于解析器配置（来自批量导入的临时覆盖）
        if "extract_tables" in kwargs:
            processor_config = {**processor_config, "table_enable": kwargs["extract_tables"]}

        # 提取通用配置并映射到 Mineru 参数
        # 1. OCR (默认为 False)
        is_ocr = kwargs.get("ocr_enabled", processor_config.get("is_ocr", False))
        # 2. 图片 (默认为 False)
        extract_images = kwargs.get("extract_images", processor_config.get("extract_images", False))

        # Mineru 参数映射
        parse_method = processor_config.get("parse_method") or ("ocr" if is_ocr else "auto")

        logger.info(
            f"MinerU processing: {file_path.name}, Method={parse_method}, Images={extract_images}"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 提交异步任务
                with open(file_path, "rb") as f:
                    suffix = file_path.suffix.lower()
                    mime_map = {
                        ".pdf": "application/pdf",
                        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        ".doc": "application/msword",
                    }
                    mime_type = mime_map.get(suffix, "application/octet-stream")
                    files = {"files": (file_path.name, f, mime_type)}

                    data = {
                        "parse_method": parse_method,
                        "lang_list": processor_config.get("lang_list", ["ch", "en"]),
                        "return_md": "true",
                        "return_images": "true" if extract_images else "false",
                    }
                    data.update(
                        {
                            k: ("true" if v is True else "false" if v is False else v)
                            for k, v in processor_config.items()
                            if k
                            not in ["is_ocr", "extract_images", "extract_tables", "parse_method"]
                        }
                    )

                    resp = await client.post(f"{self.base_url}/tasks", files=files, data=data)

                if resp.status_code != 202:
                    error_msg = f"MinerU API Error ({resp.status_code}): {resp.text}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                task_info = resp.json()
                task_id = task_info.get("task_id")
                if not task_id:
                    raise ValueError(f"MinerU async submit failed, no task_id: {task_info}")

                logger.info(f"MinerU task submitted: {task_id}")

                # 轮询任务状态
                loop = asyncio.get_running_loop()
                poll_timeout = max(self.timeout, 600.0)
                deadline = loop.time() + poll_timeout
                while True:
                    status_resp = await client.get(f"{self.base_url}/tasks/{task_id}")
                    if status_resp.status_code != 200:
                        raise ValueError(
                            f"MinerU poll error ({status_resp.status_code}): {status_resp.text}"
                        )

                    status_data = status_resp.json()
                    task_status = status_data.get("status", "")
                    logger.debug(f"MinerU task {task_id} status: {task_status}")

                    if task_status in ("done", "success", "completed"):
                        break
                    elif task_status in ("failed", "error"):
                        raise ValueError(f"MinerU task {task_id} failed: {status_data}")
                    elif loop.time() > deadline:
                        raise TimeoutError(f"MinerU task {task_id} timed out")

                    await asyncio.sleep(2)

                # 获取结果
                result_resp = await client.get(f"{self.base_url}/tasks/{task_id}/result")
                if result_resp.status_code != 200:
                    raise ValueError(
                        f"MinerU result error ({result_resp.status_code}): {result_resp.text}"
                    )

                result = result_resp.json()

                # MinerU 实际返回格式 (based on logs):
                # {
                #   "results": {
                #     "hash_id": { "md_content": "...", "images": {} }
                #   }
                # }
                markdown_content = ""
                images = []

                if "results" in result and isinstance(result["results"], dict):
                    for _, val in result["results"].items():
                        if isinstance(val, dict):
                            content = (
                                val.get("md_content") or val.get("markdown") or val.get("content")
                            )
                            if content:
                                markdown_content = content
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
                        images = []
                    except Exception as e:
                        logger.error(f"Image processing failed: {e}")
                elif markdown_content and not extract_images:
                    markdown_content = re.sub(r"!\[[^\]]*\]\(images/[^)]+\)", "", markdown_content)
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

        except Exception as e:
            logger.error(f"MinerU process failed: {e}", exc_info=True)
            raise


# 注册 MinerU
DocProcessorFactory.register(DocProcessorType.MINERU, MinerUDocProcessor)
