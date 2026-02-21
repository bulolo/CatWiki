"""add_tenant_support

Revision ID: 7a8b9c0d1e2f
Revises: 63b263450d2f
Create Date: 2026-02-10 21:55:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7a8b9c0d1e2f"
down_revision = "63b263450d2f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === 1. 创建 tenants 表 ===
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
        sa.Column(
            "max_sites", sa.Integer(), nullable=False, server_default="3", comment="最大站点数"
        ),
        sa.Column(
            "max_documents",
            sa.Integer(),
            nullable=False,
            server_default="1000",
            comment="最大文档数",
        ),
        sa.Column(
            "max_storage_mb",
            sa.Integer(),
            nullable=False,
            server_default="5120",
            comment="最大存储空间(MB)",
        ),
        sa.Column(
            "max_users", sa.Integer(), nullable=False, server_default="10", comment="最大用户数"
        ),
        sa.Column(
            "plan",
            sa.String(length=50),
            nullable=False,
            server_default="starter",
            comment="订阅计划: starter/pro/custom",
        ),
        sa.Column(
            "plan_expires_at", sa.DateTime(timezone=True), nullable=False, comment="订阅到期时间"
        ),
        sa.Column("contact_email", sa.String(length=255), nullable=True, comment="联系邮箱"),
        sa.Column("contact_phone", sa.String(length=50), nullable=True, comment="联系电话"),
        sa.Column(
            "platform_resources_allowed",
            sa.JSON(),
            nullable=False,
            server_default="[]",
            comment="允许使用的平台资源列表: models, doc_processors",
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

    # === 2. 为 sites 表添加 tenant_id 列 ===
    op.add_column(
        "sites",
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
    )
    op.create_index(op.f("ix_sites_tenant_id"), "sites", ["tenant_id"], unique=False)

    # === 3. 为 users 表添加 tenant_id 列 ===
    op.add_column(
        "users",
        sa.Column(
            "tenant_id",
            sa.Integer(),
            nullable=True,
            comment="所属租户ID(null=平台管理员)",
        ),
    )
    op.create_index(op.f("ix_users_tenant_id"), "users", ["tenant_id"], unique=False)

    # === 4. 为 system_configs 表添加 tenant_id 列 ===
    op.add_column(
        "system_configs",
        sa.Column(
            "tenant_id", sa.Integer(), nullable=True, comment="所属租户ID(null=平台全局配置)"
        ),
    )
    op.create_index(
        op.f("ix_system_configs_tenant_id"), "system_configs", ["tenant_id"], unique=False
    )
    # 移除旧的 unique 约束，添加新的复合唯一约束
    op.drop_index("ix_system_configs_config_key", table_name="system_configs")
    op.create_index(
        op.f("ix_system_configs_config_key"), "system_configs", ["config_key"], unique=False
    )
    op.create_unique_constraint(
        "uq_tenant_config_key", "system_configs", ["tenant_id", "config_key"]
    )

    # === 5. 为 document 表添加 tenant_id 列 ===
    op.add_column(
        "document", sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID")
    )
    op.create_index(op.f("ix_document_tenant_id"), "document", ["tenant_id"], unique=False)

    # === 6. 为 collection 表添加 tenant_id 列 ===
    op.add_column(
        "collection", sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID")
    )
    op.create_index(op.f("ix_collection_tenant_id"), "collection", ["tenant_id"], unique=False)

    # === 7. 为 chat_sessions 表添加 tenant_id 列 ===
    # 注意：表名在脚本中是 chat_sessions，但在参考脚本中也是如此
    op.add_column(
        "chat_sessions", sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID")
    )
    op.create_index(
        op.f("ix_chat_sessions_tenant_id"), "chat_sessions", ["tenant_id"], unique=False
    )

    # === 8. 修改 document_view_events 表 ===
    op.add_column(
        "document_view_events",
        sa.Column("tenant_id", sa.Integer(), nullable=False, comment="所属租户ID"),
    )
    # 修改索引以包含 tenant_id
    op.create_index(
        "idx_view_events_tenant_site_date",
        "document_view_events",
        ["tenant_id", "site_id", "viewed_at"],
        unique=False,
    )
    op.create_index(
        "idx_view_events_tenant_doc_date",
        "document_view_events",
        ["tenant_id", "document_id", "viewed_at"],
        unique=False,
    )
    # 移除旧索引 (假设它们存在)
    try:
        op.drop_index("idx_view_events_site_date", table_name="document_view_events")
        op.drop_index("idx_view_events_doc_date", table_name="document_view_events")
    except:
        pass


def downgrade() -> None:
    # === 8. 回滚 document_view_events ===
    op.drop_index("idx_view_events_tenant_doc_date", table_name="document_view_events")
    op.drop_index("idx_view_events_tenant_site_date", table_name="document_view_events")
    op.drop_column("document_view_events", "tenant_id")
    # 恢复旧索引 (手动指定名)
    op.create_index("idx_view_events_site_date", "document_view_events", ["site_id", "viewed_at"])
    op.create_index(
        "idx_view_events_doc_date", "document_view_events", ["document_id", "viewed_at"]
    )

    # === 7. 移除 chat_sessions 的 tenant_id ===
    op.drop_index(op.f("ix_chat_sessions_tenant_id"), table_name="chat_sessions")
    op.drop_column("chat_sessions", "tenant_id")

    # === 6. 移除 collection 的 tenant_id ===
    op.drop_index(op.f("ix_collection_tenant_id"), table_name="collection")
    op.drop_column("collection", "tenant_id")

    # === 5. 移除 document 的 tenant_id ===
    op.drop_index(op.f("ix_document_tenant_id"), table_name="document")
    op.drop_column("document", "tenant_id")

    # === 4. 移除 system_configs 的 tenant_id ===
    op.drop_constraint("uq_tenant_config_key", "system_configs", type_="unique")
    op.drop_index(op.f("ix_system_configs_config_key"), table_name="system_configs")
    op.create_index("ix_system_configs_config_key", "system_configs", ["config_key"], unique=True)
    op.drop_index(op.f("ix_system_configs_tenant_id"), table_name="system_configs")
    op.drop_column("system_configs", "tenant_id")

    # === 3. 移除 users 的 tenant_id ===
    op.drop_index(op.f("ix_users_tenant_id"), table_name="users")
    op.drop_column("users", "tenant_id")

    # === 2. 移除 sites 的 tenant_id ===
    op.drop_index(op.f("ix_sites_tenant_id"), table_name="sites")
    op.drop_column("sites", "tenant_id")

    # === 1. 删除 tenants 表 ===
    op.drop_index(op.f("ix_tenants_slug"), table_name="tenants")
    op.drop_index(op.f("ix_tenants_id"), table_name="tenants")
    op.drop_table("tenants")
