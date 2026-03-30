"""add crm tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-27 10:01:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE TYPE IF NOT EXISTS adminrole AS ENUM ('admin', 'manager', 'receptionist')"))
    op.execute(sa.text("CREATE TYPE IF NOT EXISTS messagelogstatus AS ENUM ('pending', 'sent', 'failed')"))

    # Create customers table
    op.create_table('customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('name', sa.String(200), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_customers_phone', 'customers', ['phone'], unique=True)

    # Create providers table
    op.create_table('providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_providers_email', 'providers', ['email'], unique=True)

    # Create provider_service_map table
    op.create_table('provider_service_map',
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('service_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['provider_id'], ['providers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('provider_id', 'service_id')
    )

    # Create admin_users table
    op.create_table('admin_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('role', sa.Enum('admin', 'manager', 'receptionist', name='adminrole', create_type=False), nullable=False, server_default='receptionist'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_admin_users_email', 'admin_users', ['email'], unique=True)

    # Add new columns to appointments table
    op.add_column('appointments', sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('appointments', sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('appointments', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('appointments', sa.Column('cancellation_reason', sa.Text(), nullable=True))
    op.add_column('appointments', sa.Column('rescheduled_from_slot_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_appointments_provider', 'appointments', 'providers', ['provider_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_appointments_customer', 'appointments', 'customers', ['customer_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_appointments_provider_id', 'appointments', ['provider_id'])
    op.create_index('ix_appointments_customer_id', 'appointments', ['customer_id'])

    # Create appointment_status_history table
    op.create_table('appointment_status_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('appointment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('old_status', sa.String(50), nullable=True),
        sa.Column('new_status', sa.String(50), nullable=False),
        sa.Column('changed_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_id'], ['admin_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_appt_status_history_appt_id', 'appointment_status_history', ['appointment_id'])

    # Create whatsapp_message_logs table
    op.create_table('whatsapp_message_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('appointment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('customer_phone', sa.String(20), nullable=False),
        sa.Column('message_type', sa.String(100), nullable=False),
        sa.Column('template_name', sa.String(200), nullable=True),
        sa.Column('payload_json', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'sent', 'failed', name='messagelogstatus', create_type=False), nullable=False, server_default='pending'),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_wa_logs_appointment_id', 'whatsapp_message_logs', ['appointment_id'])
    op.create_index('ix_wa_logs_customer_phone', 'whatsapp_message_logs', ['customer_phone'])

    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('admin_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('old_values_json', sa.Text(), nullable=True),
        sa.Column('new_values_json', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['admin_user_id'], ['admin_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_logs_admin_user_id', 'audit_logs', ['admin_user_id'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('whatsapp_message_logs')
    op.drop_table('appointment_status_history')
    op.drop_index('ix_appointments_customer_id', 'appointments')
    op.drop_index('ix_appointments_provider_id', 'appointments')
    op.drop_constraint('fk_appointments_customer', 'appointments', type_='foreignkey')
    op.drop_constraint('fk_appointments_provider', 'appointments', type_='foreignkey')
    op.drop_column('appointments', 'rescheduled_from_slot_id')
    op.drop_column('appointments', 'cancellation_reason')
    op.drop_column('appointments', 'notes')
    op.drop_column('appointments', 'customer_id')
    op.drop_column('appointments', 'provider_id')
    op.drop_table('admin_users')
    op.drop_table('provider_service_map')
    op.drop_table('providers')
    op.drop_table('customers')
    op.execute(sa.text("DROP TYPE IF EXISTS adminrole"))
    op.execute(sa.text("DROP TYPE IF EXISTS messagelogstatus"))
