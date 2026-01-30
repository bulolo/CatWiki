from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """基础 Schema 类"""

    model_config = ConfigDict(from_attributes=True)


class BaseSchemaWithTimestamps(BaseSchema):
    """带时间戳的基础 Schema"""

    id: int
    created_at: datetime
    updated_at: datetime

