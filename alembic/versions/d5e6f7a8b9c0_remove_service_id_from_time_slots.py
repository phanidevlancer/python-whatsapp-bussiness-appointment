"""Remove service_id from time_slots — one slot per provider per time

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-04-01 00:00:00.000000

A provider can only serve one patient at a time, so time_slots should have
no service_id. The service is recorded on the appointment, not the slot.
"""
from alembic import op
import sqlalchemy as sa

revision = 'd5e6f7a8b9c0'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the composite index that includes service_id
    op.drop_index('ix_time_slots_service_available', table_name='time_slots')

    # Wipe all referencing data — slots will be regenerated after this migration
    op.execute("UPDATE user_sessions SET selected_slot_id = NULL")
    op.execute("DELETE FROM appointment_status_history")
    op.execute("DELETE FROM appointments")
    op.execute("DELETE FROM time_slots")

    # Drop service_id column
    op.drop_constraint('time_slots_service_id_fkey', 'time_slots', type_='foreignkey')
    op.drop_column('time_slots', 'service_id')

    # Add unique constraint: one slot per provider per start_time
    op.create_index(
        'uq_time_slots_provider_start',
        'time_slots',
        ['provider_id', 'start_time'],
        unique=True,
    )

    # New index for available slot queries (provider_id + is_booked + start_time)
    op.create_index(
        'ix_time_slots_provider_available',
        'time_slots',
        ['provider_id', 'is_booked', 'start_time'],
    )


def downgrade() -> None:
    op.drop_index('ix_time_slots_provider_available', table_name='time_slots')
    op.drop_index('uq_time_slots_provider_start', table_name='time_slots')
    op.add_column('time_slots', sa.Column(
        'service_id', sa.UUID(), nullable=True
    ))
    op.create_foreign_key(
        'time_slots_service_id_fkey', 'time_slots', 'services', ['service_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_time_slots_service_available', 'time_slots', ['service_id', 'is_booked', 'start_time'])
