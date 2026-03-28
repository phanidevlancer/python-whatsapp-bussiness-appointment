"""add lead activity and sla tracking

Revision ID: a1b2c3d4e5f7
Revises: d8af39d0f566
Create Date: 2024-03-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, None] = 'd8af39d0f566'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Note: leadactivitytype enum is assumed to already exist
    # We skip creation here to avoid duplicate errors
    
    # Create lead_activities table
    op.create_table(
        'lead_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lead_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('previous_value', sa.String(length=255), nullable=True),
        sa.Column('new_value', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['lead_id'], ['booking_drop_offs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['performed_by_id'], ['admin_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on lead_id for fast lookups
    op.create_index('ix_lead_activities_lead_id', 'lead_activities', ['lead_id'])
    op.create_index('ix_lead_activities_performed_at', 'lead_activities', ['performed_at'])
    
    # Add SLA tracking fields to booking_drop_offs
    op.add_column('booking_drop_offs', 
        sa.Column('first_contacted_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('booking_drop_offs', 
        sa.Column('last_contacted_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('booking_drop_offs', 
        sa.Column('follow_up_at', sa.DateTime(timezone=True), nullable=True)
    )
    
    # Add priority score field
    op.add_column('booking_drop_offs', 
        sa.Column('priority_score', sa.Integer(), nullable=True, server_default='0')
    )
    
    # Remove server default after creation to allow NULL
    op.alter_column('booking_drop_offs', 'priority_score', 
        server_default=None, nullable=True)
    
    # Create indexes for new fields
    op.create_index('ix_booking_drop_offs_follow_up_at', 'booking_drop_offs', ['follow_up_at'])
    op.create_index('ix_booking_drop_offs_priority_score', 'booking_drop_offs', ['priority_score'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_booking_drop_offs_priority_score', table_name='booking_drop_offs')
    op.drop_index('ix_booking_drop_offs_follow_up_at', table_name='booking_drop_offs')
    op.drop_index('ix_lead_activities_performed_at', table_name='lead_activities')
    op.drop_index('ix_lead_activities_lead_id', table_name='lead_activities')
    
    # Drop columns from booking_drop_offs
    op.drop_column('booking_drop_offs', 'priority_score')
    op.drop_column('booking_drop_offs', 'follow_up_at')
    op.drop_column('booking_drop_offs', 'last_contacted_at')
    op.drop_column('booking_drop_offs', 'first_contacted_at')
    
    # Drop lead_activities table
    op.drop_table('lead_activities')
    
    # Drop enum type
    lead_activity_type = postgresql.ENUM(name='leadactivitytype')
    lead_activity_type.drop(op.get_bind())
