"""Add slot_duration_minutes to providers table

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5a6
Create Date: 2026-04-01 00:00:00.000000

Each provider now has a configurable slot duration (default 20 min).
Slot end_time is calculated from provider.slot_duration_minutes, not service.duration_minutes.
"""
from alembic import op
import sqlalchemy as sa

revision = 'c4d5e6f7a8b9'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add slot_duration_minutes column with default 20
    op.add_column(
        'providers',
        sa.Column('slot_duration_minutes', sa.Integer(), nullable=False, server_default='20'),
    )

    # Recalculate end_time for all existing slots to use provider's slot_duration_minutes.
    # Since all existing providers default to 20 min, we standardise all slots to
    # start_time + INTERVAL '20 minutes'.
    op.execute("""
        UPDATE time_slots
        SET end_time = start_time + INTERVAL '20 minutes'
        WHERE provider_id IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_column('providers', 'slot_duration_minutes')
