"""Replace appointments.slot_id unique constraint with partial unique index (confirmed only)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-27

The original unique constraint on slot_id prevented rebooking a slot after
cancellation (cancelled appointments still occupied the constraint). Replace
with a partial unique index that only enforces uniqueness for CONFIRMED status.
"""
from alembic import op

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the blanket unique constraint
    op.drop_constraint('appointments_slot_id_key', 'appointments', type_='unique')

    # Add partial unique index: only one CONFIRMED appointment per slot
    op.execute("""
        CREATE UNIQUE INDEX uq_appointments_slot_confirmed
        ON appointments (slot_id)
        WHERE status = 'CONFIRMED'
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_appointments_slot_confirmed")
    op.create_unique_constraint('appointments_slot_id_key', 'appointments', ['slot_id'])
