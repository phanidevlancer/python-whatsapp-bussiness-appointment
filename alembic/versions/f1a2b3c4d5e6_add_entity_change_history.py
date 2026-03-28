"""add entity_change_history table

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-03-28 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f1a2b3c4d5e6'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'entity_change_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.String(100), nullable=False),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('old_value', sa.Text, nullable=True),
        sa.Column('new_value', sa.Text, nullable=True),
        sa.Column('changed_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('admin_users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_entity_change_history_entity', 'entity_change_history', ['entity_type', 'entity_id'])


def downgrade() -> None:
    op.drop_index('ix_entity_change_history_entity', table_name='entity_change_history')
    op.drop_table('entity_change_history')
