# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""向量存储层类型化异常体系

调用方 catch 子类而非裸 Exception；每个子类对应不同处理策略：
- VectorStoreConnectionError  可重试（网络/服务未就绪）
- VectorStoreAuthError        不重试（凭据错误），需告警
- VectorStoreDimensionError   不重试，需操作干预（重建 Schema）
- VectorStoreBulkWriteError   部分可重试，failed_ids 列出具体失败
- VectorStoreSchemaError      Schema 操作失败，查权限或日志
"""


class VectorStoreError(Exception):
    """向量存储层根异常"""


class VectorStoreConnectionError(VectorStoreError):
    """连接失败，可触发重试"""


class VectorStoreAuthError(VectorStoreError):
    """认证失败，不重试，需告警"""


class VectorStoreDimensionError(VectorStoreError):
    """向量维度与已有 Schema 不匹配，需操作干预"""


class VectorStoreBulkWriteError(VectorStoreError):
    def __init__(self, message: str, failed_ids: list[str] | None = None):
        super().__init__(message)
        self.failed_ids: list[str] = failed_ids or []


class VectorStoreSchemaError(VectorStoreError):
    """Schema 创建、迁移或验证失败"""
