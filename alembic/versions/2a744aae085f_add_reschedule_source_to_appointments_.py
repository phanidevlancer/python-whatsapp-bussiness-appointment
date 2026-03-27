"""add reschedule_source to appointments and history

Revision ID: 2a744aae085f
Revises: 019994f690f3
Create Date: 2026-03-27 21:57:55.527252

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a744aae085f'
down_revision: Union[str, None] = '019994f690f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add reschedule_source column to appointments table
    op.add_column(
        'appointments',
        sa.Column(
            'reschedule_source',
            sa.Enum('whatsapp', 'admin_dashboard', name='appointmentsource'),
            nullable=True
        )
    )
    
    # Add reschedule_source column to appointment_status_history table
    op.add_column(
        'appointment_status_history',
        sa.Column(
            'reschedule_source',
            sa.Enum('whatsapp', 'admin_dashboard', name='appointmentsource'),
            nullable=True
        )
    )


def downgrade() -> None:
    # Remove reschedule_source column from appointment_status_history table
    op.drop_column('appointment_status_history', 'reschedule_source')
    
    # Remove reschedule_source column from appointments table
    op.drop_column('appointments', 'reschedule_source')
