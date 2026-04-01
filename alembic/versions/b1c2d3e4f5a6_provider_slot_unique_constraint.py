"""Add unique constraint for one confirmed appointment per provider slot

Revision ID: b1c2d3e4f5a6
Revises: e1f2a3b4c5d6
Create Date: 2026-04-01 00:00:00.000000

Previously slots used a single is_booked flag, implying one appointment per slot.
With provider-specific slots, each provider has their own slot row and the real
uniqueness rule is: one confirmed appointment per (slot_id, provider_id) pair.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add unique constraint: one confirmed appointment per provider slot.
    # We use a partial unique index (WHERE status = 'confirmed') so cancelled
    # or pending appointments on the same slot don't block re-booking.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_provider_slot_confirmed
        ON appointments (slot_id, provider_id)
        WHERE status = 'confirmed'
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_appointment_provider_slot_confirmed")
