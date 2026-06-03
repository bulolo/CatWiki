"""add show_pipeline_trace column to sites

# Revision ID: add_site_show_pipeline_trace
# Revises: drop_ai_vl_config
# Create Date: 2026-05-26

"""

import sqlalchemy as sa

from alembic import op

revision = "add_site_show_pipeline_trace"
down_revision = "drop_ai_vl_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sites",
        sa.Column(
            "show_pipeline_trace",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="是否在对话页展示 AI 性能统计（TTFB / 首字 / 总耗时 / 工具耗时 / Tokens）",
        ),
    )


def downgrade() -> None:
    op.drop_column("sites", "show_pipeline_trace")
