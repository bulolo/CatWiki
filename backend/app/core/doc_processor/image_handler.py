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
import uuid
import mimetypes
from io import BytesIO

from app.core.infra.config import settings
from app.core.infra.rustfs import get_rustfs_service

logger = logging.getLogger(__name__)


class ImageProcessor:
    def __init__(self):
        self.storage = get_rustfs_service()

    def _upload_image(self, image_data: bytes, original_filename: str = None) -> str | None:
        """
        上传图片到 RustFS 并返回公开 URL
        """
        if not self.storage.is_available():
            logger.warning("RustFS 不可用，跳过图片上传")
            return None

        # 生成唯一文件名
        ext = "png"
        if original_filename:
            parts = original_filename.split(".")
            if len(parts) > 1:
                ext = parts[-1]

        object_name = f"doc_images/{uuid.uuid4()}.{ext}"

        # 准备数据流
        file_data = BytesIO(image_data)
        file_size = len(image_data)

        # 推断 content_type
        content_type, _ = mimetypes.guess_type(object_name)
        if not content_type:
            content_type = "application/octet-stream"

        success = self.storage.upload_file(
            object_name=object_name,
            file_data=file_data,
            file_size=file_size,
            content_type=content_type,
        )

        if success:
            return self.storage.get_public_url(object_name, use_presigned=False)
        return None

    async def process_docling_content(self, markdown: str) -> str:
        """
        处理 Docling 的 Base64 图片:
        匹配 ![](data:image/jpeg;base64,...) 并替换为 URL
        """
        # 匹配 Markdown 图片语法，且 URL 是 data:image 开头
        pattern = re.compile(r"!\[(.*?)\]\((data:image/(.*?);base64,(.*?))\)")

        def replace_match(match):
            alt_text = match.group(1)
            full_data_uri = match.group(2)
            ext = match.group(3)
            base64_str = match.group(4)

            try:
                image_data = base64.b64decode(base64_str)
                # 使用提取的扩展名
                filename = f"image.{ext}"

                url = self._upload_image(image_data, filename)
                if url:
                    return f"![{alt_text}]({url})"
            except Exception as e:
                logger.error(f"Docling 图片处理失败: {e}")

            # 失败保留原样
            return str(match.group(0))

        # re.sub 不支持 async 回调，这里直接同步执行
        # 考虑到 minio 客户端也是同步的，暂且如此
        return pattern.sub(replace_match, markdown)

    async def process_mineru_content(self, markdown: str, images_dict: dict) -> str:
        """
        处理 Mineru 的 Images 字典:
        markdown 中引用为 ![](images/xxx.jpg)
        images_dict 中为 "xxx.jpg": "data:image/jpeg;base64,..."
        """
        if not images_dict:
            return markdown

        for filename, base64_full_str in images_dict.items():
            if not base64_full_str:
                continue

            try:
                if "," in base64_full_str:
                    header, base64_str = base64_full_str.split(",", 1)
                else:
                    base64_str = base64_full_str

                image_data = base64.b64decode(base64_str)
                url = self._upload_image(image_data, filename)

                if url:
                    # 替换 Markdown 中的引用
                    # Mineru 输出通常是 ![](images/filename)
                    target_str = f"images/{filename}"
                    markdown = markdown.replace(target_str, url)
            except Exception as e:
                logger.error(f"Mineru 图片处理失败 ({filename}): {e}")

        return markdown

    async def process_paddleocr_content(self, content: str, images_dict: dict) -> str:
        """
        处理 PaddleOCR 的 Images 字典:
        PaddleOCR 输出格式与 MinerU 略有不同:
        - 路径前缀是 imgs/ 而不是 images/
        - 可能使用 HTML <img> 标签而不是 Markdown 语法

        images_dict 格式: {"img_xxx.jpg": "base64_string"}
        """
        if not images_dict:
            return content

        for filename, base64_full_str in images_dict.items():
            if not base64_full_str:
                continue

            try:
                if "," in base64_full_str:
                    header, base64_str = base64_full_str.split(",", 1)
                else:
                    base64_str = base64_full_str

                image_data = base64.b64decode(base64_str)
                url = self._upload_image(image_data, filename)

                if url:
                    # PaddleOCR 使用 imgs/ 前缀
                    target_str = f"imgs/{filename}"
                    content = content.replace(target_str, url)

                    # 也替换不带前缀的情况
                    content = content.replace(filename, url)

            except Exception as e:
                logger.error(f"PaddleOCR 图片处理失败 ({filename}): {e}")

        return content
