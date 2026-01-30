from pydantic import BaseModel, Field


class SiteStats(BaseModel):
    """站点统计数据"""

    total_documents: int = Field(description="文档总数")
    total_views: int = Field(description="总访问次数")

    model_config = {"from_attributes": True}

