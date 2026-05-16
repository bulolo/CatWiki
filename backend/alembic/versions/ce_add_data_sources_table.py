"""add data_sources table

# Revision ID: add_data_sources
# Revises: d161a6891c2d
# Create Date: 2026-05-14

"""

import sqlalchemy as sa

from alembic import op

revision = "add_data_sources"
down_revision = "d161a6891c2d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
        sa.Column("name", sa.String(length=100), nullable=False, comment="数据源名称"),
        sa.Column(
            "type",
            sa.String(length=20),
            nullable=False,
            server_default="internal",
            comment="类型: internal | s3",
        ),
        sa.Column("description", sa.Text(), nullable=True, comment="描述"),
        sa.Column("config", sa.JSON(), nullable=False, server_default="{}", comment="连接配置"),
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_data_sources_id", "data_sources", ["id"], unique=False)
    op.create_index("ix_data_sources_tenant_id", "data_sources", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_data_sources_tenant_id", table_name="data_sources")
    op.drop_index("ix_data_sources_id", table_name="data_sources")
    op.drop_table("data_sources")
