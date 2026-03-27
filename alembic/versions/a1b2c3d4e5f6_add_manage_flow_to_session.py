"""add manage flow states and selected_appointment_id to user_sessions

Revision ID: a1b2c3d4e5f6
Revises: e4276c15b8ac
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e4276c15b8ac'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new enum values to the sessionstep type.
    # PostgreSQL requires ALTER TYPE ... ADD VALUE outside of a transaction.
    op.execute("ALTER TYPE sessionstep ADD VALUE IF NOT EXISTS 'MANAGE_MENU'")
    op.execute("ALTER TYPE sessionstep ADD VALUE IF NOT EXISTS 'MANAGE_APPOINTMENT'")
    op.execute("ALTER TYPE sessionstep ADD VALUE IF NOT EXISTS 'RESCHEDULE_SLOT'")

    # Add selected_appointment_id column to user_sessions
    op.add_column(
        'user_sessions',
        sa.Column(
            'selected_appointment_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('appointments.id'),
            nullable=True,
        )
    )


def downgrade() -> None:
    op.drop_column('user_sessions', 'selected_appointment_id')
    # Note: PostgreSQL does not support removing enum values.
    # To fully downgrade, drop and recreate the enum (requires no rows using new values).
