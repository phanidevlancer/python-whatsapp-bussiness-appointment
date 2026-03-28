"""
Follow-up Reminders Service

Background task that checks for leads with scheduled follow-ups
and sends reminders to assigned agents.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking_drop_off import BookingDropOff, LeadStatus
from app.models.admin_user import AdminUser
from app.services.lead_notification_service import notify_follow_up_reminder

logger = logging.getLogger(__name__)


async def get_leads_due_for_follow_up(
    db: AsyncSession,
    hours_ahead: int = 24,
) -> List[BookingDropOff]:
    """
    Get all leads with follow_up_at in the next N hours.
    
    Args:
        db: Database session
        hours_ahead: Look ahead window (default: 24 hours)
        
    Returns:
        List of leads due for follow-up
    """
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=hours_ahead)
    
    query = (
        select(BookingDropOff)
        .where(
            BookingDropOff.follow_up_at != None,
            BookingDropOff.follow_up_at <= window_end,
            BookingDropOff.follow_up_at >= now,
            BookingDropOff.status.notin_([LeadStatus.CONVERTED, LeadStatus.LOST]),
        )
        .order_by(BookingDropOff.follow_up_at)
    )
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_overdue_follow_ups(
    db: AsyncSession,
    hours_overdue: int = 24,
) -> List[BookingDropOff]:
    """
    Get all leads with follow_up_at in the past (overdue).
    
    Args:
        db: Database session
        hours_overdue: How far back to check (default: 24 hours)
        
    Returns:
        List of overdue leads
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours_overdue)
    
    query = (
        select(BookingDropOff)
        .where(
            BookingDropOff.follow_up_at != None,
            BookingDropOff.follow_up_at < now,
            BookingDropOff.follow_up_at >= cutoff,
            BookingDropOff.status.notin_([LeadStatus.CONVERTED, LeadStatus.LOST]),
        )
        .order_by(BookingDropOff.follow_up_at)
    )
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def process_follow_up_reminders(db: AsyncSession) -> dict:
    """
    Process all follow-up reminders.
    
    Sends notifications for:
    1. Leads due for follow-up in next 24 hours
    2. Overdue follow-ups (past 24 hours)
    
    Returns:
        Dictionary with counts of processed reminders
    """
    results = {
        "due_soon": 0,
        "overdue": 0,
        "notified": 0,
        "errors": 0,
    }
    
    # Get leads due soon
    due_soon = await get_leads_due_for_follow_up(db, hours_ahead=24)
    results["due_soon"] = len(due_soon)
    
    # Get overdue leads
    overdue = await get_overdue_follow_ups(db, hours_overdue=24)
    results["overdue"] = len(overdue)
    
    # Process due soon reminders
    for lead in due_soon:
        try:
            await notify_follow_up_reminder(db, lead)
            results["notified"] += 1
            logger.info(
                "Follow-up reminder sent: lead=%s assigned_to=%s due_at=%s",
                lead.id,
                lead.assigned_to.name if lead.assigned_to else "Unassigned",
                lead.follow_up_at,
            )
        except Exception as e:
            results["errors"] += 1
            logger.error(
                "Failed to send follow-up reminder for lead %s: %s",
                lead.id, e,
            )
    
    # Process overdue alerts (more urgent)
    for lead in overdue:
        try:
            # TODO: Send urgent notification instead of regular reminder
            await notify_follow_up_reminder(db, lead)
            results["notified"] += 1
            logger.warning(
                "OVERDUE follow-up: lead=%s assigned_to=%s was_due_at=%s",
                lead.id,
                lead.assigned_to.name if lead.assigned_to else "Unassigned",
                lead.follow_up_at,
            )
        except Exception as e:
            results["errors"] += 1
            logger.error(
                "Failed to send overdue alert for lead %s: %s",
                lead.id, e,
            )
    
    return results


async def check_sla_compliance(db: AsyncSession) -> dict:
    """
    Check for leads that have breached SLA response time.
    
    SLA: Contact lead within configured hours (default: 2 hours)
    
    Returns:
        Dictionary with breach statistics
    """
    from app.core.config import settings
    
    sla_hours = getattr(settings, 'LEAD_SLA_HOURS', 2)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=sla_hours)
    
    query = (
        select(BookingDropOff)
        .where(
            BookingDropOff.status == LeadStatus.NEW_LEAD,
            BookingDropOff.created_at < cutoff,
            BookingDropOff.first_contacted_at == None,
        )
        .order_by(BookingDropOff.created_at)
    )
    
    result = await db.execute(query)
    breached_leads = list(result.scalars().all())
    
    # Notify for each breach
    for lead in breached_leads:
        hours_overdue = (datetime.now(timezone.utc) - lead.created_at).total_seconds() / 3600 - sla_hours
        # TODO: Import and call notify_sla_breach
        logger.warning(
            "SLA BREACH: lead=%s phone=%s hours_overdue=%.1f",
            lead.id, lead.phone, hours_overdue,
        )
    
    return {
        "breached_count": len(breached_leads),
        "sla_hours": sla_hours,
    }
