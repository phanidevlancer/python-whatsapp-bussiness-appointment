"""add campaign runner v1 schema

Revision ID: 5a6b7c8d9e0f
Revises: c9d0e1f2a3b4
Create Date: 2026-03-29 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "5a6b7c8d9e0f"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_postgres_enum_labels(bind, enum_name: str) -> list[str]:
    rows = bind.execute(
        sa.text(
            """
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = :enum_name
            ORDER BY e.enumsortorder
            """
        ),
        {"enum_name": enum_name},
    )
    return list(rows.scalars().all())


def _bootstrap_postgres_enum(bind, enum_name: str, labels: list[str]) -> postgresql.ENUM:
    existing_labels = _get_postgres_enum_labels(bind, enum_name)
    if existing_labels:
        if existing_labels != labels:
            raise RuntimeError(
                f"Existing enum type {enum_name!r} has labels {existing_labels!r}, expected {labels!r}"
            )
    else:
        postgresql.ENUM(*labels, name=enum_name).create(bind, checkfirst=True)

    return postgresql.ENUM(*labels, name=enum_name, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()

    campaign_audience_type_enum = _bootstrap_postgres_enum(
        bind,
        "campaignaudiencetype",
        [
            "all_customers",
            "customers_with_previous_bookings",
            "customers_inactive_for_days",
            "uploaded_phone_list",
        ],
    )
    campaign_delivery_status_enum = _bootstrap_postgres_enum(
        bind,
        "campaigndeliverystatus",
        [
            "pending",
            "sent",
            "delivered",
            "read",
            "clicked",
            "failed",
            "skipped",
        ],
    )

    op.add_column(
        "campaigns",
        sa.Column(
            "audience_type",
            campaign_audience_type_enum,
            nullable=False,
            server_default="all_customers",
        ),
    )
    op.alter_column("campaigns", "audience_type", server_default=None, existing_type=campaign_audience_type_enum)
    op.add_column(
        "campaigns",
        sa.Column(
            "audience_filters",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.alter_column(
        "campaigns",
        "audience_filters",
        server_default=None,
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
    )
    op.add_column("campaigns", sa.Column("message_body", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("message_footer", sa.String(length=255), nullable=True))
    op.add_column("campaigns", sa.Column("button_label", sa.String(length=120), nullable=True))
    op.add_column("campaigns", sa.Column("image_path", sa.String(length=255), nullable=True))
    op.add_column("campaigns", sa.Column("image_media_id", sa.String(length=255), nullable=True))
    op.add_column("campaigns", sa.Column("batch_size", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("batch_delay_seconds", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("last_error", sa.Text(), nullable=True))

    op.create_table(
        "campaign_recipients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("customer_name", sa.String(length=200), nullable=True),
        sa.Column("delivery_status", campaign_delivery_status_enum, nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("skipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], name="fk_campaign_recipients_campaign_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], name="fk_campaign_recipients_customer_id", ondelete="SET NULL"),
    )
    op.create_index("ix_campaign_recipients_campaign_id", "campaign_recipients", ["campaign_id"], unique=False)
    op.create_index("ix_campaign_recipients_customer_id", "campaign_recipients", ["customer_id"], unique=False)
    op.create_index("ix_campaign_recipients_phone", "campaign_recipients", ["phone"], unique=False)

    op.create_table(
        "campaign_send_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_message_id", sa.String(length=120), nullable=True),
        sa.Column("status", campaign_delivery_status_enum, nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], name="fk_campaign_send_logs_campaign_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["campaign_recipients.id"], name="fk_campaign_send_logs_recipient_id", ondelete="CASCADE"),
    )
    op.create_index("ix_campaign_send_logs_campaign_id", "campaign_send_logs", ["campaign_id"], unique=False)
    op.create_index("ix_campaign_send_logs_recipient_id", "campaign_send_logs", ["recipient_id"], unique=False)
    op.create_index("ix_campaign_send_logs_provider_message_id", "campaign_send_logs", ["provider_message_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_campaign_send_logs_provider_message_id", table_name="campaign_send_logs")
    op.drop_index("ix_campaign_send_logs_recipient_id", table_name="campaign_send_logs")
    op.drop_index("ix_campaign_send_logs_campaign_id", table_name="campaign_send_logs")
    op.drop_table("campaign_send_logs")

    op.drop_index("ix_campaign_recipients_phone", table_name="campaign_recipients")
    op.drop_index("ix_campaign_recipients_customer_id", table_name="campaign_recipients")
    op.drop_index("ix_campaign_recipients_campaign_id", table_name="campaign_recipients")
    op.drop_table("campaign_recipients")

    op.drop_column("campaigns", "last_error")
    op.drop_column("campaigns", "failed_at")
    op.drop_column("campaigns", "completed_at")
    op.drop_column("campaigns", "started_at")
    op.drop_column("campaigns", "batch_delay_seconds")
    op.drop_column("campaigns", "batch_size")
    op.drop_column("campaigns", "image_media_id")
    op.drop_column("campaigns", "image_path")
    op.drop_column("campaigns", "button_label")
    op.drop_column("campaigns", "message_footer")
    op.drop_column("campaigns", "message_body")
    op.drop_column("campaigns", "audience_filters")
    op.drop_column("campaigns", "audience_type")
