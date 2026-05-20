# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""document 子包 —— 文档服务的对外入口与内部分层。

外部调用方应当**只**从本包顶层 import（``from app.services.document import
DocumentService``），不要直接引用子模块。

子模块结构：

| 文件 | 内容 |
|---|---|
| ``service``       | ``DocumentService`` —— CRUD + 导入流水线 + 向量化任务分发（DI）|
| ``vectorization`` | 文档切分与向量入库（worker 直接调用）|
| ``enrichment``    | LLM 元数据增强（summary / tags 等衍生字段，无 DB 依赖）|
"""

from app.services.document.enrichment import enrich_document_with_llm
from app.services.document.service import DocumentService, get_document_service
from app.services.document.vectorization import (
    delete_document_vector,
    is_document_vectorizable,
    process_document_vectorization,
)

__all__ = [
    "DocumentService",
    "get_document_service",
    # 直接给 worker / 任务系统调用的模块函数（无 DI 依赖）
    "process_document_vectorization",
    "delete_document_vector",
    "is_document_vectorizable",
    "enrich_document_with_llm",
]
