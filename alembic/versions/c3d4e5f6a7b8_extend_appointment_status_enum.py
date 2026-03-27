"""extend appointment status enum

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-27 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL requires ALTER TYPE ADD VALUE to run outside a transaction.
    # Alembic wraps migrations in transactions by default.
    # We commit the current transaction, run the ALTER, then start a new one.
    op.execute(sa.text("COMMIT"))
    op.execute(sa.text("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'completed'"))
    op.execute(sa.text("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'no_show'"))
    op.execute(sa.text("BEGIN"))


def downgrade() -> None:
    # Cannot remove values from a PostgreSQL enum without recreating the type
    pass
