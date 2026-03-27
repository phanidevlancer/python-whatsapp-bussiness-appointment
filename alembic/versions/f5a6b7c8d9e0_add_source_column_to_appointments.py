"""add source column to appointments

Revision ID: f5a6b7c8d9e0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-27 21:01:47.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type first (lowercase values to match Python enum)
    appointment_source_enum = sa.Enum('whatsapp', 'admin_dashboard', name='appointmentsource')
    appointment_source_enum.create(op.get_bind())
    
    # Add the column with a default value
    op.add_column('appointments', sa.Column('source', appointment_source_enum, nullable=False, server_default='admin_dashboard'))


def downgrade() -> None:
    # Drop the column
    op.drop_column('appointments', 'source')
    
    # Drop the enum type
    appointment_source_enum = sa.Enum(name='appointmentsource')
    appointment_source_enum.drop(op.get_bind())
