"""add campaign journeys and service cost

Revision ID: c9d0e1f2a3b4
Revises: b7c8d9e0f1a2
Create Date: 2026-03-29 12:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    campaign_status_enum = postgresql.ENUM("active", "paused", "expired", name="campaignstatus", create_type=False)
    campaign_discount_type_enum = postgresql.ENUM("none", "percent", "flat", name="campaigndiscounttype", create_type=False)
    journey_type_enum = postgresql.ENUM("organic", "campaign", name="journeytype", create_type=False)

    postgresql.ENUM("active", "paused", "expired", name="campaignstatus").create(bind, checkfirst=True)
    postgresql.ENUM("none", "percent", "flat", name="campaigndiscounttype").create(bind, checkfirst=True)
    postgresql.ENUM("organic", "campaign", name="journeytype").create(bind, checkfirst=True)

    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", campaign_status_enum, nullable=False, server_default="active"),
        sa.Column("booking_button_id", sa.String(length=120), nullable=True),
        sa.Column("allowed_service_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("allowed_weekdays", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("per_user_booking_limit", sa.Integer(), nullable=True),
        sa.Column("discount_type", campaign_discount_type_enum, nullable=False, server_default="none"),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_campaigns_code"),
        sa.UniqueConstraint("booking_button_id", name="uq_campaigns_booking_button_id"),
    )
    op.create_index("ix_campaigns_code", "campaigns", ["code"], unique=True)
    op.create_index("ix_campaigns_booking_button_id", "campaigns", ["booking_button_id"], unique=True)

    op.add_column("services", sa.Column("cost", sa.Numeric(10, 2), nullable=False, server_default="0"))

    op.add_column("user_sessions", sa.Column("active_journey_type", journey_type_enum, nullable=False, server_default="organic"))
    op.add_column("user_sessions", sa.Column("active_campaign_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("user_sessions", sa.Column("journey_started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    op.add_column("user_sessions", sa.Column("journey_entry_point", sa.String(length=50), nullable=True))
    op.add_column("user_sessions", sa.Column("journey_entry_message_id", sa.String(length=128), nullable=True))
    op.create_index("ix_user_sessions_active_campaign_id", "user_sessions", ["active_campaign_id"], unique=False)
    op.create_foreign_key(
        "fk_user_sessions_active_campaign_id",
        "user_sessions",
        "campaigns",
        ["active_campaign_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("appointments", sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("appointments", sa.Column("campaign_code_snapshot", sa.String(length=80), nullable=True))
    op.add_column("appointments", sa.Column("campaign_name_snapshot", sa.String(length=120), nullable=True))
    op.add_column("appointments", sa.Column("discount_type_snapshot", sa.String(length=20), nullable=True))
    op.add_column("appointments", sa.Column("discount_value_snapshot", sa.Numeric(10, 2), nullable=True))
    op.add_column("appointments", sa.Column("service_cost_snapshot", sa.Numeric(10, 2), nullable=True))
    op.add_column("appointments", sa.Column("final_cost_snapshot", sa.Numeric(10, 2), nullable=True))
    op.create_index("ix_appointments_campaign_id", "appointments", ["campaign_id"], unique=False)
    op.create_index("ix_appointments_campaign_code_snapshot", "appointments", ["campaign_code_snapshot"], unique=False)
    op.create_foreign_key(
        "fk_appointments_campaign_id",
        "appointments",
        "campaigns",
        ["campaign_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_constraint("fk_appointments_campaign_id", "appointments", type_="foreignkey")
    op.drop_index("ix_appointments_campaign_code_snapshot", table_name="appointments")
    op.drop_index("ix_appointments_campaign_id", table_name="appointments")
    op.drop_column("appointments", "final_cost_snapshot")
    op.drop_column("appointments", "service_cost_snapshot")
    op.drop_column("appointments", "discount_value_snapshot")
    op.drop_column("appointments", "discount_type_snapshot")
    op.drop_column("appointments", "campaign_name_snapshot")
    op.drop_column("appointments", "campaign_code_snapshot")
    op.drop_column("appointments", "campaign_id")

    op.drop_constraint("fk_user_sessions_active_campaign_id", "user_sessions", type_="foreignkey")
    op.drop_index("ix_user_sessions_active_campaign_id", table_name="user_sessions")
    op.drop_column("user_sessions", "journey_entry_message_id")
    op.drop_column("user_sessions", "journey_entry_point")
    op.drop_column("user_sessions", "journey_started_at")
    op.drop_column("user_sessions", "active_campaign_id")
    op.drop_column("user_sessions", "active_journey_type")

    op.drop_column("services", "cost")

    op.drop_index("ix_campaigns_booking_button_id", table_name="campaigns")
    op.drop_index("ix_campaigns_code", table_name="campaigns")
    op.drop_table("campaigns")

    sa.Enum(name="journeytype").drop(bind, checkfirst=True)
    sa.Enum(name="campaigndiscounttype").drop(bind, checkfirst=True)
    sa.Enum(name="campaignstatus").drop(bind, checkfirst=True)
