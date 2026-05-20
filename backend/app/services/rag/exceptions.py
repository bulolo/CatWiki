# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""RAG 服务层类型化异常。

把"检索失败"和"真无结果"区分开：工具层根据异常类型回写不同的 ToolMessage，
让 agent 能识别为系统不可用（停止重试）而非"知识库没有该信息"（继续追问）。
"""


class RAGError(Exception):
    """RAG 服务层根异常。"""


class RAGRetrievalError(RAGError):
    """检索过程失败（向量库 / Embedding / Reranker 任一环节抛出）。

    与"召回结果为空"语义不同：召回为空走正常返回路径（`[]` 或
    NO_RESULTS_MESSAGE），而本异常表示底层服务不可用。
    """
