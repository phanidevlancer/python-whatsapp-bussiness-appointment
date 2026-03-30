"""fix appointmentstatus enum values to lowercase

Revision ID: e1f2a3b4c5d6
Revises: 5a6b7c8d9e0f
Create Date: 2026-03-31 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = '5a6b7c8d9e0f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename uppercase enum values to lowercase
    op.execute(sa.text("ALTER TYPE appointmentstatus RENAME VALUE 'PENDING' TO 'pending'"))
    op.execute(sa.text("ALTER TYPE appointmentstatus RENAME VALUE 'CONFIRMED' TO 'confirmed'"))
    op.execute(sa.text("ALTER TYPE appointmentstatus RENAME VALUE 'CANCELLED' TO 'cancelled'"))


def downgrade() -> None:
    op.execute(sa.text("ALTER TYPE appointmentstatus RENAME VALUE 'pending' TO 'PENDING'"))
    op.execute(sa.text("ALTER TYPE appointmentstatus RENAME VALUE 'confirmed' TO 'CONFIRMED'"))
    op.execute(sa.text("ALTER TYPE appointmentstatus RENAME VALUE 'cancelled' TO 'CANCELLED'"))
