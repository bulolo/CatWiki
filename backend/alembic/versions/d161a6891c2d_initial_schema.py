"""initial schema: all tables"""

# Revision ID: d161a6891c2d
# Revises:
# Create Date: 2025-12-30 21:01:25.687934

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "d161a6891c2d"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "tenants",
        sa.Column("name", sa.String(length=100), nullable=False, comment="企业名称"),
        sa.Column("slug", sa.String(length=50), nullable=False, comment="URL标识(唯一)"),
        sa.Column("domain", sa.String(length=200), nullable=True, comment="自定义域名"),
        sa.Column("logo_url", sa.String(length=500), nullable=True, comment="Logo URL"),
        sa.Column("description", sa.Text(), nullable=True, comment="企业描述"),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="trial",
            comment="租户状态: active, suspended, trial",
        ),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain"),
    )
    op.create_index(op.f("ix_tenants_id"), "tenants", ["id"], unique=False)
    op.create_index(op.f("ix_tenants_slug"), "tenants", ["slug"], unique=True)

    op.create_table(
        "sites",
        sa.Column("name", sa.String(length=100), nullable=False, comment="站点名称"),
        sa.Column("slug", sa.String(length=200), nullable=False, comment="站点标识"),
        sa.Column("description", sa.Text(), nullable=True, comment="站点描述"),
        sa.Column("icon", sa.String(length=1000), nullable=True, comment="图标URL或名称"),
        sa.Column("status", sa.String(length=20), nullable=False, comment="状态: active, disabled"),
        sa.Column("article_count", sa.Integer(), nullable=False, comment="文章数量"),
        sa.Column("theme_color", sa.String(length=50), nullable=True, comment="主题色"),
        sa.Column(
            "layout_mode", sa.String(length=20), nullable=True, comment="布局模式: sidebar, top"
        ),
        sa.Column("quick_questions", sa.JSON(), nullable=True, comment="快速问题配置"),
        sa.Column("bot_config", sa.JSON(), nullable=True, comment="机器人配置"),
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_sites_id"), "sites", ["id"], unique=False)
    op.create_index(op.f("ix_sites_name"), "sites", ["name"], unique=False)

    op.create_table(
        "users",
        sa.Column("name", sa.String(length=100), nullable=False, comment="用户名"),
        sa.Column("email", sa.String(length=255), nullable=False, comment="邮箱"),
        sa.Column("password_hash", sa.String(length=255), nullable=False, comment="密码哈希"),
        sa.Column(
            "role",
            sa.Enum("ADMIN", "SITE_ADMIN", "EDITOR", name="userrole", native_enum=False, length=20),
            nullable=False,
            comment="用户角色",
        ),
        sa.Column(
            "status",
            sa.Enum(
                "ACTIVE", "INACTIVE", "PENDING", name="userstatus", native_enum=False, length=20
            ),
            nullable=False,
            comment="用户状态",
        ),
        sa.Column(
            "managed_site_ids",
            sa.String(length=500),
            nullable=True,
            comment="管理的站点ID列表，逗号分隔",
        ),
        sa.Column(
            "last_login_at", sa.DateTime(timezone=True), nullable=True, comment="最后登录时间"
        ),
        sa.Column("last_login_ip", sa.String(length=50), nullable=True, comment="最后登录IP"),
        sa.Column("avatar_url", sa.String(length=500), nullable=True, comment="头像URL"),
        sa.Column("tenant_id", sa.Integer(), nullable=True, comment="所属租户ID(null=平台管理员)"),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "system_configs",
        sa.Column(
            "config_key", sa.String(length=100), nullable=False, comment="配置键，如 'ai_config'"
        ),
        sa.Column(
            "config_value",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            comment="配置值（JSON 格式）",
        ),
        sa.Column("description", sa.String(length=500), nullable=True, comment="配置项描述"),
        sa.Column("is_active", sa.Boolean(), nullable=False, comment="是否启用该配置"),
        sa.Column(
            "tenant_id", sa.Integer(), nullable=True, comment="所属租户ID(null表示平台全局配置)"
        ),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "config_key", name="uq_tenant_config_key"),
    )
    op.create_index(op.f("ix_system_configs_id"), "system_configs", ["id"], unique=False)
    op.create_index(
        op.f("ix_system_configs_config_key"), "system_configs", ["config_key"], unique=False
    )

    op.create_table(
        "collection",
        sa.Column("title", sa.String(length=200), nullable=False, comment="合集名称"),
        sa.Column("site_id", sa.Integer(), nullable=False, comment="所属站点ID"),
        sa.Column("parent_id", sa.Integer(), nullable=True, comment="父合集ID"),
        sa.Column("order", sa.Integer(), nullable=False, comment="排序"),
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_collection_id"), "collection", ["id"], unique=False)
    op.create_index(op.f("ix_collection_parent_id"), "collection", ["parent_id"], unique=False)
    op.create_index(op.f("ix_collection_site_id"), "collection", ["site_id"], unique=False)
    op.create_index(op.f("ix_collection_title"), "collection", ["title"], unique=False)
    op.create_index(op.f("ix_collection_tenant_id"), "collection", ["tenant_id"], unique=False)

    op.create_table(
        "document",
        sa.Column("title", sa.String(length=200), nullable=False, comment="文章标题"),
        sa.Column("content", sa.Text(), nullable=True, comment="文章内容(Markdown)"),
        sa.Column("summary", sa.Text(), nullable=True, comment="文章摘要"),
        sa.Column("cover_image", sa.String(length=500), nullable=True, comment="封面图片URL"),
        sa.Column("site_id", sa.Integer(), nullable=False, comment="所属站点ID"),
        sa.Column("collection_id", sa.Integer(), nullable=True, comment="所属合集ID"),
        sa.Column("category", sa.String(length=100), nullable=True, comment="分类"),
        sa.Column("author", sa.String(length=100), nullable=False, comment="作者"),
        sa.Column("status", sa.String(length=20), nullable=False, comment="状态: published, draft"),
        sa.Column(
            "vector_status",
            sa.String(length=20),
            nullable=False,
            server_default="none",
            comment="向量化状态",
        ),
        sa.Column("vector_error", sa.Text(), nullable=True, comment="向量化失败错误信息"),
        sa.Column(
            "vectorized_at", sa.DateTime(timezone=True), nullable=True, comment="最后向量化完成时间"
        ),
        sa.Column("views", sa.Integer(), nullable=False, comment="浏览量"),
        sa.Column("reading_time", sa.Integer(), nullable=False, comment="预计阅读时间(分钟)"),
        sa.Column("tags", sa.JSON(), nullable=True, comment="标签列表"),
        sa.Column(
            "parse_meta",
            sa.JSON(),
            nullable=True,
            comment="文档解析元数据：解析器类型、原始文件路径、耗时等",
        ),
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_document_id"), "document", ["id"], unique=False)
    op.create_index(op.f("ix_document_collection_id"), "document", ["collection_id"], unique=False)
    op.create_index(op.f("ix_document_site_id"), "document", ["site_id"], unique=False)
    op.create_index(op.f("ix_document_title"), "document", ["title"], unique=False)
    op.create_index(op.f("ix_document_vector_status"), "document", ["vector_status"], unique=False)
    op.create_index(op.f("ix_document_tenant_id"), "document", ["tenant_id"], unique=False)

    op.create_table(
        "document_view_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("site_id", sa.Integer(), nullable=False),
        sa.Column(
            "viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("member_id", sa.Integer(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("referer", sa.Text(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["document_id"], ["document.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_document_view_events_document_id"),
        "document_view_events",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_document_view_events_member_id"),
        "document_view_events",
        ["member_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_document_view_events_tenant_id"),
        "document_view_events",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "idx_view_events_tenant_site_date",
        "document_view_events",
        ["tenant_id", "site_id", "viewed_at"],
    )
    op.create_index(
        "idx_view_events_tenant_doc_date",
        "document_view_events",
        ["tenant_id", "document_id", "viewed_at"],
    )

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "thread_id",
            sa.String(length=255),
            nullable=False,
            comment="LangGraph Checkpointer thread_id",
        ),
        sa.Column("site_id", sa.Integer(), nullable=False, comment="站点ID"),
        sa.Column(
            "member_id",
            sa.String(length=255),
            nullable=True,
            comment="会员ID或访客标识（可选，支持匿名）",
        ),
        sa.Column("title", sa.String(length=255), nullable=True, comment="会话标题"),
        sa.Column("last_message", sa.Text(), nullable=True, comment="最后消息预览"),
        sa.Column(
            "last_message_role",
            sa.String(length=20),
            nullable=True,
            comment="最后消息角色 user/assistant",
        ),
        sa.Column(
            "message_count", sa.Integer(), nullable=False, server_default="0", comment="消息数量"
        ),
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_sessions_id"), "chat_sessions", ["id"], unique=False)
    op.create_index("ix_chat_sessions_thread_id", "chat_sessions", ["thread_id"], unique=True)
    op.create_index("ix_chat_sessions_site_id", "chat_sessions", ["site_id"], unique=False)
    op.create_index("ix_chat_sessions_member_id", "chat_sessions", ["member_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("thread_id", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tool_calls", sa.JSON(), nullable=True),
        sa.Column("tool_call_id", sa.String(length=255), nullable=True),
        sa.Column("additional_kwargs", sa.JSON(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_sessions.thread_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_id"), "chat_messages", ["id"], unique=False)
    op.create_index(
        op.f("ix_chat_messages_thread_id"), "chat_messages", ["thread_id"], unique=False
    )

    op.create_table(
        "task",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
        sa.Column("site_id", sa.Integer(), nullable=True, comment="所属站点ID"),
        sa.Column("task_type", sa.String(length=50), nullable=False, comment="任务类型"),
        sa.Column("status", sa.String(length=20), nullable=False, comment="任务状态"),
        sa.Column("job_id", sa.String(length=100), nullable=True, comment="Arq Job ID"),
        sa.Column("progress", sa.Float(), nullable=False, comment="进度 (0.0 - 100.0)"),
        sa.Column("payload", sa.JSON(), nullable=True, comment="任务参数"),
        sa.Column("result", sa.JSON(), nullable=True, comment="执行结果"),
        sa.Column("error", sa.Text(), nullable=True, comment="错误信息"),
        sa.Column("created_by", sa.String(length=100), nullable=False, comment="创建者"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_id"), "task", ["id"], unique=False)
    op.create_index(op.f("ix_task_tenant_id"), "task", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_task_site_id"), "task", ["site_id"], unique=False)
    op.create_index(op.f("ix_task_task_type"), "task", ["task_type"], unique=False)
    op.create_index(op.f("ix_task_status"), "task", ["status"], unique=False)
    op.create_index(op.f("ix_task_job_id"), "task", ["job_id"], unique=False)


def downgrade() -> None:
    op.drop_table("task")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("document_view_events")
    op.drop_table("document")
    op.drop_table("collection")
    op.drop_table("system_configs")
    op.drop_table("users")
    op.drop_table("sites")
    op.drop_table("tenants")
    op.execute("DROP EXTENSION IF EXISTS vector")
