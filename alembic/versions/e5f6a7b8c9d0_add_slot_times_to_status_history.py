"""add slot times to appointment status history

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-27 19:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = '1347cccef1c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('appointment_status_history',
        sa.Column('slot_start_time', sa.DateTime(timezone=True), nullable=True))
    op.add_column('appointment_status_history',
        sa.Column('old_slot_start_time', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('appointment_status_history', 'old_slot_start_time')
    op.drop_column('appointment_status_history', 'slot_start_time')
