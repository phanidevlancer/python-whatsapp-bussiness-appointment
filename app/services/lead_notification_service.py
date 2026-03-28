"""
Lead Notification Service

Handles notifications for lead events:
- New lead created
- Lead assigned to agent
- SLA breach warning
- Follow-up reminders
"""

import logging
from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking_drop_off import BookingDropOff
from app.models.admin_user import AdminUser

logger = logging.getLogger(__name__)


class NotificationChannel:
    """Notification channels."""
    SSE = "sse"  # Server-sent events (real-time dashboard)
    EMAIL = "email"
    SLACK = "slack"
    WHATSAPP = "whatsapp"


async def notify_new_lead(
    db: AsyncSession,
    lead: BookingDropOff,
    assigned_agent: Optional[AdminUser] = None,
) -> None:
    """
    Send notifications when a new lead is created.
    
    Args:
        db: Database session
        lead: Newly created lead
        assigned_agent: Agent the lead was assigned to (if any)
    """
    # Log for now - in production, integrate with actual notification systems
    logger.info(
        "New lead created: id=%s phone=%s type=%s priority=%d assigned_to=%s",
        lead.id,
        lead.phone,
        lead.customer_type.value,
        lead.priority_score or 0,
        assigned_agent.name if assigned_agent else "Unassigned",
    )
    
    # TODO: Implement actual notifications
    # - Send SSE event to dashboard
    # - Send email to assigned agent
    # - Send Slack notification to #leads channel


async def notify_lead_assigned(
    db: AsyncSession,
    lead: BookingDropOff,
    agent: AdminUser,
    assigned_by: Optional[AdminUser] = None,
) -> None:
    """
    Send notifications when a lead is assigned to an agent.
    
    Args:
        db: Database session
        lead: Lead that was assigned
        agent: Agent who received the assignment
        assigned_by: Admin user who made the assignment (if manual)
    """
    assigner_name = assigned_by.name if assigned_by else "System"
    
    logger.info(
        "Lead assigned: id=%s to=%s by=%s",
        lead.id, agent.name, assigner_name,
    )
    
    # TODO: Send notification to assigned agent


async def notify_sla_breach(
    db: AsyncSession,
    lead: BookingDropOff,
    hours_overdue: float,
) -> None:
    """
    Send notifications when a lead exceeds SLA response time.
    
    Args:
        db: Database session
        lead: Lead that breached SLA
        hours_overdue: How many hours past the SLA deadline
    """
    logger.warning(
        "SLA breach: lead=%s phone=%s hours_overdue=%.1f assigned_to=%s",
        lead.id,
        lead.phone,
        hours_overdue,
        lead.assigned_to.name if lead.assigned_to else "Unassigned",
    )
    
    # TODO: Send urgent notification to:
    # - Assigned agent (if any)
    # - Team lead/manager
    # - Slack #leads-alerts channel


async def notify_follow_up_reminder(
    db: AsyncSession,
    lead: BookingDropOff,
) -> None:
    """
    Send reminder for scheduled follow-up.
    
    Args:
        db: Database session
        lead: Lead with scheduled follow-up
    """
    logger.info(
        "Follow-up reminder: lead=%s phone=%s scheduled_for=%s assigned_to=%s",
        lead.id,
        lead.phone,
        lead.follow_up_at,
        lead.assigned_to.name if lead.assigned_to else "Unassigned",
    )
    
    # TODO: Send reminder to assigned agent


async def broadcast_lead_event(
    event_type: str,
    lead_id: uuid.UUID,
    data: dict,
) -> None:
    """
    Broadcast lead event via SSE to connected dashboard clients.
    
    This integrates with the SSE event system in main.py
    
    Args:
        event_type: Type of event (lead.created, lead.assigned, etc.)
        lead_id: Lead UUID
        data: Event payload data
    """
    # Import here to avoid circular imports
    from app.core.event_broadcaster import broadcast_event
    
    await broadcast_event(
        event_type=event_type,
        data={
            "lead_id": str(lead_id),
            **data,
        },
    )
