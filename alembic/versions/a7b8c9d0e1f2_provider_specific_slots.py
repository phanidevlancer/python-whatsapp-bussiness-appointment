"""Add provider role and provider_id to time_slots

Revision ID: a7b8c9d0e1f2
Revises: e1f2a3b4c5d6
Create Date: 2026-04-01 00:00:00.000000

Adds providers.role (string, default 'doctor') and
time_slots.provider_id (nullable FK to providers).
This migration was applied directly; this file is the reconstructed stub.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a7b8c9d0e1f2'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Already applied — columns exist in DB.
    # Add role column if it somehow doesn't exist (idempotent guard).
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='providers' AND column_name='role'"
    ))
    if not result.fetchone():
        op.add_column('providers', sa.Column('role', sa.String(50), nullable=False, server_default='doctor'))

    result2 = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='time_slots' AND column_name='provider_id'"
    ))
    if not result2.fetchone():
        op.add_column('time_slots', sa.Column(
            'provider_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('providers.id', ondelete='SET NULL'),
            nullable=True,
        ))


def downgrade() -> None:
    op.drop_column('time_slots', 'provider_id')
    op.drop_column('providers', 'role')
