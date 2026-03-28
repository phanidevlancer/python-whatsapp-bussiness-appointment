"""add rbac and user management tables

Revision ID: b7c8d9e0f1a2
Revises: cb1d68941f55
Create Date: 2026-03-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "cb1d68941f55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("module", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )
    op.create_index("ix_permissions_module", "permissions", ["module"], unique=False)

    op.create_table(
        "role_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("copied_from_template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["copied_from_template_id"], ["role_templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_role_templates_name"),
    )

    op.create_table(
        "role_template_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["role_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "permission_id", name="uq_role_template_permissions_template_permission"),
    )
    op.create_index("ix_role_template_permissions_template_id", "role_template_permissions", ["template_id"], unique=False)
    op.create_index("ix_role_template_permissions_permission_id", "role_template_permissions", ["permission_id"], unique=False)

    op.add_column(
        "admin_users",
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "admin_users",
        sa.Column("employee_code", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "admin_users",
        sa.Column("phone", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "admin_users",
        sa.Column("is_first_login", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "admin_users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "admin_users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "admin_users",
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "admin_users",
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "admin_users",
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "admin_users",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_admin_users_template_id", "admin_users", ["template_id"], unique=False)
    op.create_index("ix_admin_users_employee_code", "admin_users", ["employee_code"], unique=True)
    op.create_foreign_key("fk_admin_users_template_id", "admin_users", "role_templates", ["template_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_admin_users_created_by", "admin_users", "admin_users", ["created_by"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_admin_users_updated_by", "admin_users", "admin_users", ["updated_by"], ["id"], ondelete="SET NULL")

    op.create_table(
        "user_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("performed_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("details_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["performed_by_id"], ["admin_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["admin_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_audit_log_user_id", "user_audit_log", ["user_id"], unique=False)
    op.create_index("ix_user_audit_log_action", "user_audit_log", ["action"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_audit_log_action", table_name="user_audit_log")
    op.drop_index("ix_user_audit_log_user_id", table_name="user_audit_log")
    op.drop_table("user_audit_log")

    op.drop_constraint("fk_admin_users_updated_by", "admin_users", type_="foreignkey")
    op.drop_constraint("fk_admin_users_created_by", "admin_users", type_="foreignkey")
    op.drop_constraint("fk_admin_users_template_id", "admin_users", type_="foreignkey")
    op.drop_index("ix_admin_users_employee_code", table_name="admin_users")
    op.drop_index("ix_admin_users_template_id", table_name="admin_users")
    op.drop_column("admin_users", "locked_until")
    op.drop_column("admin_users", "failed_login_attempts")
    op.drop_column("admin_users", "updated_by")
    op.drop_column("admin_users", "created_by")
    op.drop_column("admin_users", "last_login_at")
    op.drop_column("admin_users", "must_change_password")
    op.drop_column("admin_users", "is_first_login")
    op.drop_column("admin_users", "phone")
    op.drop_column("admin_users", "employee_code")
    op.drop_column("admin_users", "template_id")

    op.drop_index("ix_role_template_permissions_permission_id", table_name="role_template_permissions")
    op.drop_index("ix_role_template_permissions_template_id", table_name="role_template_permissions")
    op.drop_table("role_template_permissions")

    op.drop_table("role_templates")

    op.drop_index("ix_permissions_module", table_name="permissions")
    op.drop_table("permissions")
