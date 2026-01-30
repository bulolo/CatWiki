from typing import List, Any
from datetime import datetime


from pydantic import BaseModel, Field

from app.models.document import DocumentStatus, VectorStatus
from app.schemas.base import BaseSchemaWithTimestamps


class CollectionAncestor(BaseModel):
    """合集祖先节点"""
    id: int = Field(..., description="合集ID")
    title: str = Field(..., description="合集名称")


class CollectionInfo(BaseModel):
    """文档关联的合集信息"""
    id: int = Field(..., description="合集ID")
    title: str = Field(..., description="合集名称")
    parent_id: int | None = Field(None, description="父合集ID")
    ancestors: list[CollectionAncestor] = Field(default_factory=list, description="祖先合集链（从根到父级）")
    path: str = Field(..., description="合集完整路径（如: 流式细胞术基础 > 仪器与试剂 > 选购指南）")


class DocumentBase(BaseModel):
    """文档基础 Schema"""
    title: str = Field(..., max_length=200, description="文章标题")
    content: str | None = Field(None, description="文章内容(Markdown)")
    summary: str | None = Field(None, description="文章摘要")
    cover_image: str | None = Field(None, description="封面图片URL")
    site_id: int = Field(..., description="所属站点ID")
    collection_id: int = Field(..., description="所属合集ID（必填）")
    category: str | None = Field(None, max_length=100, description="分类")
    author: str = Field(..., max_length=100, description="作者")
    status: DocumentStatus = Field(default=DocumentStatus.DRAFT, description="状态: published, draft")
    vector_status: VectorStatus = Field(default=VectorStatus.NONE, description="向量化状态: none, pending, processing, completed, failed")
    tags: list[str] | None = Field(default_factory=list, description="标签列表")


class DocumentCreate(DocumentBase):
    """创建文档"""
    pass


class DocumentUpdate(BaseModel):
    """更新文档"""
    title: str | None = Field(None, max_length=200)
    content: str | None = None
    summary: str | None = None
    cover_image: str | None = None
    collection_id: int | None = None
    category: str | None = None
    author: str | None = None
    status: DocumentStatus | None = None
    vector_status: VectorStatus | None = None
    tags: list[str] | None = None


class Document(DocumentBase, BaseSchemaWithTimestamps):
    """文档详情"""
    views: int = Field(default=0, description="浏览量")
    reading_time: int = Field(default=0, description="预计阅读时间(分钟)")
    vector_error: str | None = Field(None, description="向量化失败错误信息")
    vectorized_at: datetime | None = Field(None, description="最后向量化完成时间")

    # 关联字段
    site_name: str | None = Field(None, description="站点名称")
    collection: CollectionInfo | None = Field(None, description="所属合集信息")


class VectorizeRequest(BaseModel):
    """向量化请求"""
    document_ids: list[int] = Field(..., min_length=1, description="要向量化的文档ID列表")



class VectorizeResponse(BaseModel):
    """向量化响应"""
    success_count: int = Field(..., description="成功排队的文档数")
    failed_count: int = Field(..., description="失败的文档数")
    document_ids: list[int] = Field(..., description="已排队的文档ID列表")


class VectorRetrieveFilter(BaseModel):
    """向量检索过滤器"""
    site_id: int | None = Field(None, description="站点ID (可选过滤)")
    id: str | None = Field(None, description="文档ID (可选过滤)")
    source: str | None = Field("document", description="来源 (可选过滤)")


class VectorRetrieveRequest(BaseModel):
    """向量检索请求"""
    query: str = Field(..., description="检索查询语句")
    k: int = Field(5, description="返回结果数量")
    threshold: float = Field(0.3, description="相似度阈值")
    filter: VectorRetrieveFilter | None = Field(None, description="过滤器 (可选)")
    enable_rerank: bool = Field(default=False, description="是否启用重排序")
    rerank_k: int = Field(5, description="重排序后返回的数量")


class VectorRetrieveResponse(BaseModel):
    """向量检索响应"""
    content: str = Field(..., description="文档片段内容")
    score: float = Field(..., description="检索得分 (相似度)")
    original_score: float | None = Field(None, description="原始检索得分 (重排序前)")
    document_id: int = Field(..., description="文档 ID")
    document_title: str | None = Field(None, description="文档标题")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


class VectorRetrieveResult(BaseModel):
    """向量检索结果集"""
    list: List[VectorRetrieveResponse] = Field(..., description="检索结果列表")
