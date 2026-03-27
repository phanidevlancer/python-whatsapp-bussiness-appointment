"""add source field to appointment status history

Revision ID: 1347cccef1c5
Revises: 2a744aae085f
Create Date: 2026-03-27 22:12:00.051269

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1347cccef1c5'
down_revision: Union[str, None] = '2a744aae085f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add source column to appointment_status_history table
    op.add_column(
        'appointment_status_history',
        sa.Column(
            'source',
            sa.Enum('whatsapp', 'admin_dashboard', name='appointmentsource'),
            nullable=True
        )
    )


def downgrade() -> None:
    # Remove source column from appointment_status_history table
    op.drop_column('appointment_status_history', 'source')
