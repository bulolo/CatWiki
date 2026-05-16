"""add source column to chat_sessions

# Revision ID: add_session_source
# Revises: add_data_sources
# Create Date: 2026-05-15

"""

import sqlalchemy as sa

from alembic import op

revision = "add_session_source"
down_revision = "add_data_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("source", sa.String(length=50), nullable=True, comment="来源渠道"),
    )
    op.create_index("ix_chat_sessions_source", "chat_sessions", ["source"])


def downgrade() -> None:
    op.drop_index("ix_chat_sessions_source", table_name="chat_sessions")
    op.drop_column("chat_sessions", "source")
