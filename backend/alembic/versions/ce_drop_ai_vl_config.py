"""drop ai_vl system_configs rows

Revision ID: drop_ai_vl_config
Revises: add_session_source
Create Date: 2026-05-20

VL (Vision-Language) 模型类型已下线：现代多模态 chat 模型已覆盖该能力，独立的
VL 配置成为死字段。本次迁移仅清理 system_configs 中的 ai_vl 行；环境变量
AI_VL_API_KEY/BASE/MODEL 同步从代码中移除。

Idempotent：不存在的 key 不报错。仅 DML，不动 schema。
"""

import sqlalchemy as sa

from alembic import op

revision = "drop_ai_vl_config"
down_revision = "add_session_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM system_configs WHERE config_key = 'ai_vl'"))


def downgrade() -> None:
    # 不可逆：VL 字段已从代码中移除，回滚也无法重建已丢失的配置内容。
    # 如确需回滚，需手动在数据库重新插入 ai_vl 配置行。
    pass
