"""add cancellation_source to appointments

Revision ID: 019994f690f3
Revises: d8af39d0f566
Create Date: 2026-03-27 21:46:43.508068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '019994f690f3'
down_revision: Union[str, None] = 'd8af39d0f566'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add cancellation_source column to appointments table
    op.add_column(
        'appointments',
        sa.Column(
            'cancellation_source',
            sa.Enum('whatsapp', 'admin_dashboard', name='appointmentsource'),
            nullable=True
        )
    )


def downgrade() -> None:
    # Remove cancellation_source column from appointments table
    op.drop_column('appointments', 'cancellation_source')
