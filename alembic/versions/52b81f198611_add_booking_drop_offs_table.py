"""add booking_drop_offs table

Revision ID: 52b81f198611
Revises: f1a2b3c4d5e6
Create Date: 2026-03-28 12:50:58.166928

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

revision: str = '52b81f198611'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

leadstatus = PG_ENUM('new_lead', 'contacted', 'follow_up', 'converted', 'lost', name='leadstatus')
customertype = PG_ENUM('prospect', 'returning', 're_engaged', name='customertype')


def upgrade() -> None:
    leadstatus.create(op.get_bind(), checkfirst=True)
    customertype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'booking_drop_offs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=True),
        sa.Column('dropped_at_step', sa.String(length=50), nullable=False),
        sa.Column('selected_service_id', sa.UUID(), nullable=True),
        sa.Column('selected_slot_id', sa.UUID(), nullable=True),
        sa.Column('session_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dropped_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('status', PG_ENUM('new_lead', 'contacted', 'follow_up', 'converted', 'lost', name='leadstatus', create_type=False), nullable=False, server_default='new_lead'),
        sa.Column('customer_type', PG_ENUM('prospect', 'returning', 're_engaged', name='customertype', create_type=False), nullable=False, server_default='prospect'),
        sa.Column('assigned_to_id', sa.UUID(), nullable=True),
        sa.Column('crm_notes', sa.Text(), nullable=True),
        sa.Column('converted_appointment_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['admin_users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['converted_appointment_id'], ['appointments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['selected_service_id'], ['services.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['selected_slot_id'], ['time_slots.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_booking_drop_offs_customer_type', 'booking_drop_offs', ['customer_type'])
    op.create_index('ix_booking_drop_offs_phone', 'booking_drop_offs', ['phone'])
    op.create_index('ix_booking_drop_offs_status', 'booking_drop_offs', ['status'])


def downgrade() -> None:
    op.drop_index('ix_booking_drop_offs_status', table_name='booking_drop_offs')
    op.drop_index('ix_booking_drop_offs_phone', table_name='booking_drop_offs')
    op.drop_index('ix_booking_drop_offs_customer_type', table_name='booking_drop_offs')
    op.drop_table('booking_drop_offs')
    leadstatus.drop(op.get_bind(), checkfirst=True)
    customertype.drop(op.get_bind(), checkfirst=True)
