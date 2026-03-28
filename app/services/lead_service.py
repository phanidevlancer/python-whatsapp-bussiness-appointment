import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus
from app.models.booking_drop_off import CustomerType, LeadStatus
from app.models.customer import Customer
from app.models.admin_user import AdminUser
from app.models.user_session import UserSession, SessionStep
from app.repositories import lead_repository as lead_repo
from app.repositories import appointment_repository as appt_repo
from app.schemas.lead import LeadConvertRequest
from app.services.lead_assignment_service import auto_assign_lead, calculate_priority_score, AssignmentStrategy
from app.services.lead_notification_service import notify_new_lead, broadcast_lead_event
from app.core.config import settings

logger = logging.getLogger(__name__)

# Steps meaningful enough to capture as a lead drop-off
CAPTURABLE_STEPS = {
    SessionStep.SERVICE_SELECTED,
    SessionStep.SLOT_SELECTED,
    SessionStep.AWAITING_NAME,
    SessionStep.AWAITING_EMAIL,
}


async def _determine_customer_type(db: AsyncSession, phone: str) -> CustomerType:
    """
    Classify the dropping user:
    - prospect    : no prior appointments
    - returning   : has confirmed or completed appointments
    - re_engaged  : had an open lead before (never converted), came back
    """
    # Normalize phone variants
    normalized = phone.lstrip('+').lstrip('0')
    variants = [normalized, '+' + normalized, phone]

    # Check for prior confirmed/completed appointments
    result = await db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.user_phone.in_(variants),
            Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED]),
        )
    )
    prior_count = result.scalar_one()
    if prior_count > 0:
        return CustomerType.RETURNING

    # Check for prior unconverted leads
    from app.models.booking_drop_off import BookingDropOff
    result = await db.execute(
        select(func.count(BookingDropOff.id)).where(
            BookingDropOff.phone.in_(variants),
            BookingDropOff.status == LeadStatus.LOST,
        )
    )
    prior_lost = result.scalar_one()
    if prior_lost > 0:
        return CustomerType.RE_ENGAGED

    return CustomerType.PROSPECT


async def capture_drop_off(
    db: AsyncSession,
    session: UserSession,
) -> None:
    """
    Called when a WhatsApp session resets mid-flow or expires.
    Writes a drop-off record if the step is meaningful.
    """
    if session.current_step not in CAPTURABLE_STEPS:
        return

    phone = session.user_phone
    customer_type = await _determine_customer_type(db, phone)

    # Try to find linked customer
    customer_result = await db.execute(
        select(Customer).where(Customer.phone == phone).limit(1)
    )
    customer = customer_result.scalar_one_or_none()

    # Calculate priority score
    priority_score = calculate_priority_score(
        customer_type=customer_type.value,
        dropped_at_step=session.current_step.value,
    )

    # Determine if we should auto-assign
    assignment_strategy = getattr(settings, "LEAD_ASSIGNMENT_STRATEGY", AssignmentStrategy.NONE)
    
    lead = await lead_repo.upsert_drop_off(
        db,
        phone=phone,
        dropped_at_step=session.current_step.value,
        customer_type=customer_type,
        customer_id=customer.id if customer else None,
        selected_service_id=session.selected_service_id,
        selected_slot_id=session.selected_slot_id,
        session_started_at=session.created_at,
        priority_score=priority_score,
    )
    
    # Auto-assign if enabled and this is a new lead
    if lead.status == LeadStatus.NEW_LEAD and assignment_strategy != AssignmentStrategy.NONE:
        assigned_agent_id = await auto_assign_lead(
            db,
            lead_id=lead.id,
            strategy=assignment_strategy,
            current_user_id=None,  # System-generated
        )
        
        # Get assigned agent info for notification
        if assigned_agent_id:
            agent_result = await db.execute(
                select(AdminUser).where(AdminUser.id == assigned_agent_id).limit(1)
            )
            assigned_agent = agent_result.scalar_one_or_none()
        else:
            assigned_agent = None
        
        # Send notifications
        await notify_new_lead(db, lead, assigned_agent)
        await broadcast_lead_event("lead.created", lead.id, {
            "phone": lead.phone,
            "customer_type": lead.customer_type.value,
            "priority_score": lead.priority_score,
            "assigned_to": assigned_agent.name if assigned_agent else None,
        })
    else:
        # Still broadcast even if not auto-assigned
        await broadcast_lead_event("lead.created", lead.id, {
            "phone": lead.phone,
            "customer_type": lead.customer_type.value,
            "priority_score": lead.priority_score,
            "assigned_to": None,
        })
    
    logger.info(
        "Drop-off captured: phone=%s step=%s type=%s priority=%d",
        phone, session.current_step.value, customer_type.value, priority_score,
    )


async def capture_drop_off_from_cancellation(
    db: AsyncSession,
    appointment,  # Appointment model instance
) -> None:
    """
    Called when the clinic cancels an appointment (admin_dashboard source).
    Creates a 'returning' lead so the CRM team can proactively re-book the customer.
    """
    phone = appointment.user_phone
    customer_type = CustomerType.RETURNING  # They already had a booking — always returning

    # Try to find linked customer
    customer_result = await db.execute(
        select(Customer).where(Customer.phone == phone).limit(1)
    )
    customer = customer_result.scalar_one_or_none()

    # Calculate priority score - cancelled appointments are high priority
    priority_score = calculate_priority_score(
        customer_type=customer_type.value,
        dropped_at_step="APPOINTMENT_CANCELLED",
    )

    # Determine if we should auto-assign
    assignment_strategy = getattr(settings, "LEAD_ASSIGNMENT_STRATEGY", AssignmentStrategy.NONE)
    
    lead = await lead_repo.upsert_drop_off(
        db,
        phone=phone,
        dropped_at_step="APPOINTMENT_CANCELLED",
        customer_type=customer_type,
        customer_id=customer.id if customer else (appointment.customer_id or None),
        selected_service_id=appointment.service_id,
        selected_slot_id=None,  # slot is now freed
        priority_score=priority_score,
    )
    
    # Auto-assign if enabled
    if lead.status == LeadStatus.NEW_LEAD and assignment_strategy != AssignmentStrategy.NONE:
        await auto_assign_lead(
            db,
            lead_id=lead.id,
            strategy=assignment_strategy,
            current_user_id=None,  # System-generated
        )
    
    logger.info(
        "Drop-off lead created from clinic cancellation: phone=%s appt=%s priority=%d",
        phone, appointment.id, priority_score,
    )


async def convert_lead(
    db: AsyncSession,
    lead_id: uuid.UUID,
    payload: LeadConvertRequest,
    current_user,
) -> Appointment:
    """
    Convert a lead by manually creating an appointment on their behalf.
    Marks the lead as converted and links the new appointment.
    """
    from fastapi import HTTPException

    lead = await lead_repo.get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == LeadStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Lead already converted")

    service_id = payload.service_id or lead.selected_service_id
    if not service_id:
        raise HTTPException(status_code=400, detail="No service selected — provide service_id")

    # Find or create customer
    normalized = lead.phone.lstrip('+').lstrip('0')
    customer_result = await db.execute(
        select(Customer).where(Customer.phone.in_([normalized, lead.phone])).limit(1)
    )
    customer = customer_result.scalar_one_or_none()

    appt = await appt_repo.create_appointment_crm(
        db,
        user_phone=lead.phone,
        service_id=service_id,
        slot_id=payload.slot_id,
        provider_id=payload.provider_id,
        customer_id=customer.id if customer else None,
        notes=payload.notes,
    )

    await lead_repo.update_lead(
        db,
        lead_id=lead_id,
        status=LeadStatus.CONVERTED,
        converted_appointment_id=appt.id,
    )

    logger.info("Lead %s converted to appointment %s by %s", lead_id, appt.id, current_user.id)
    return appt
