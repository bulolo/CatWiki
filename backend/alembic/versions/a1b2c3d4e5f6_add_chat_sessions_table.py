"""add_chat_sessions_table

Revision ID: a1b2c3d4e5f6
Revises: d161a6891c2d
Create Date: 2026-02-01 23:20:00.000000

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'd161a6891c2d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建 chat_sessions 表"""
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('thread_id', sa.String(length=255), nullable=False, comment='LangGraph Checkpointer thread_id'),
        sa.Column('site_id', sa.Integer(), nullable=False, comment='站点ID'),
        sa.Column('member_id', sa.Integer(), nullable=True, comment='会员ID（可选，支持匿名）'),
        sa.Column('title', sa.String(length=255), nullable=True, comment='会话标题'),
        sa.Column('last_message', sa.Text(), nullable=True, comment='最后消息预览'),
        sa.Column('last_message_role', sa.String(length=20), nullable=True, comment='最后消息角色 user/assistant'),
        sa.Column('message_count', sa.Integer(), nullable=False, server_default='0', comment='消息数量'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # 创建索引
    op.create_index('ix_chat_sessions_thread_id', 'chat_sessions', ['thread_id'], unique=True)
    op.create_index('ix_chat_sessions_site_id', 'chat_sessions', ['site_id'], unique=False)
    op.create_index('ix_chat_sessions_member_id', 'chat_sessions', ['member_id'], unique=False)
    op.create_index('ix_chat_sessions_updated_at', 'chat_sessions', ['updated_at'], unique=False)


def downgrade() -> None:
    """删除 chat_sessions 表"""
    op.drop_index('ix_chat_sessions_updated_at', table_name='chat_sessions')
    op.drop_index('ix_chat_sessions_member_id', table_name='chat_sessions')
    op.drop_index('ix_chat_sessions_site_id', table_name='chat_sessions')
    op.drop_index('ix_chat_sessions_thread_id', table_name='chat_sessions')
    op.drop_table('chat_sessions')
