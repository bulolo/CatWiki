"""add chat_message_feedback table

# Revision ID: add_chat_message_feedback
# Revises: add_site_show_pipeline_trace
# Create Date: 2026-05-27

"""

import sqlalchemy as sa

from alembic import op

revision = "add_chat_message_feedback"
down_revision = "add_site_show_pipeline_trace"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_message_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "chat_message_id",
            sa.Integer(),
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"),
            nullable=False,
            comment="对应的助手消息行 ID",
        ),
        sa.Column(
            "member_id",
            sa.String(length=64),
            nullable=False,
            comment="访客/会员 ID",
        ),
        sa.Column("rating", sa.String(length=8), nullable=False, comment="up | down"),
        sa.Column(
            "reason",
            sa.String(length=32),
            nullable=True,
            comment="差评原因：incorrect / irrelevant / incomplete / slow",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("chat_message_id", "member_id", name="uq_feedback_message_member"),
    )
    op.create_index(
        "ix_chat_message_feedback_chat_message_id",
        "chat_message_feedback",
        ["chat_message_id"],
    )
    op.create_index(
        "ix_chat_message_feedback_member_id",
        "chat_message_feedback",
        ["member_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_message_feedback_member_id", table_name="chat_message_feedback")
    op.drop_index("ix_chat_message_feedback_chat_message_id", table_name="chat_message_feedback")
    op.drop_table("chat_message_feedback")
