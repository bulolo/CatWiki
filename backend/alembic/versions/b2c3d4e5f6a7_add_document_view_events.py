"""add document view events table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建 document_view_events 表"""
    op.create_table(
        'document_view_events',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('site_id', sa.Integer(), nullable=False),
        sa.Column('viewed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('member_id', sa.Integer(), nullable=True),  # 预留：未来会员系统
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('referer', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['document.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建索引
    op.create_index('idx_view_events_site_date', 'document_view_events', ['site_id', 'viewed_at'])
    op.create_index('idx_view_events_doc_date', 'document_view_events', ['document_id', 'viewed_at'])
    op.create_index('idx_view_events_member', 'document_view_events', ['member_id'])


def downgrade() -> None:
    """删除 document_view_events 表"""
    op.drop_index('idx_view_events_member', table_name='document_view_events')
    op.drop_index('idx_view_events_doc_date', table_name='document_view_events')
    op.drop_index('idx_view_events_site_date', table_name='document_view_events')
    op.drop_table('document_view_events')
