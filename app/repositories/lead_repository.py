import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking_drop_off import BookingDropOff, LeadStatus, CustomerType
from app.models.user_session import SessionStep
from app.models.lead_activity import LeadActivity, LeadActivityType
from app.utils.phone import normalize_phone, get_phone_variants


# Steps that are meaningful enough to capture as a lead
CAPTURABLE_STEPS = {
    SessionStep.SERVICE_SELECTED,
    SessionStep.SLOT_SELECTED,
    SessionStep.AWAITING_NAME,
    SessionStep.AWAITING_EMAIL,
}


async def upsert_drop_off(
    db: AsyncSession,
    phone: str,
    dropped_at_step: str,
    customer_type: CustomerType,
    customer_id: Optional[uuid.UUID] = None,
    selected_service_id: Optional[uuid.UUID] = None,
    selected_slot_id: Optional[uuid.UUID] = None,
    session_started_at: Optional[datetime] = None,
    priority_score: Optional[int] = None,
) -> BookingDropOff:
    """
    Upsert a drop-off record. If an open lead (not converted/lost) already
    exists for this phone, refresh it instead of creating a duplicate.
    """
    # Normalize phone for consistent matching
    normalized_phone = normalize_phone(phone)
    phone_variants = get_phone_variants(normalized_phone)

    # Find existing open lead for this phone (check all variants)
    result = await db.execute(
        select(BookingDropOff)
        .where(
            BookingDropOff.phone.in_(phone_variants),
            BookingDropOff.status.notin_([LeadStatus.CONVERTED, LeadStatus.LOST]),
        )
        .order_by(BookingDropOff.created_at.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if existing:
        # Refresh with latest drop-off info
        existing.dropped_at_step = dropped_at_step
        existing.customer_type = customer_type
        existing.selected_service_id = selected_service_id
        existing.selected_slot_id = selected_slot_id
        existing.dropped_at = now
        if customer_id:
            existing.customer_id = customer_id
        if priority_score is not None:
            existing.priority_score = priority_score
        await db.flush()
        return existing

    # Create new
    drop_off = BookingDropOff(
        phone=phone,
        customer_id=customer_id,
        dropped_at_step=dropped_at_step,
        customer_type=customer_type,
        selected_service_id=selected_service_id,
        selected_slot_id=selected_slot_id,
        session_started_at=session_started_at,
        dropped_at=now,
        status=LeadStatus.NEW_LEAD,
        priority_score=priority_score or 0,
    )
    db.add(drop_off)
    await db.flush()
    return drop_off


async def list_leads(
    db: AsyncSession,
    status: Optional[LeadStatus] = None,
    customer_type: Optional[CustomerType] = None,
    assigned_to_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[BookingDropOff], int]:
    query = (
        select(BookingDropOff)
        .options(
            selectinload(BookingDropOff.customer),
            selectinload(BookingDropOff.service),
            selectinload(BookingDropOff.assigned_to),
        )
    )
    if status:
        query = query.where(BookingDropOff.status == status)
    if customer_type:
        query = query.where(BookingDropOff.customer_type == customer_type)
    if assigned_to_id:
        query = query.where(BookingDropOff.assigned_to_id == assigned_to_id)
    if search:
        # Normalize search term and match against all phone variants
        normalized_search = normalize_phone(search)
        phone_variants = get_phone_variants(normalized_search)
        query = query.where(BookingDropOff.phone.in_(phone_variants))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = query.order_by(BookingDropOff.dropped_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_lead_by_id(db: AsyncSession, lead_id: uuid.UUID) -> Optional[BookingDropOff]:
    result = await db.execute(
        select(BookingDropOff)
        .options(
            selectinload(BookingDropOff.customer),
            selectinload(BookingDropOff.service),
            selectinload(BookingDropOff.assigned_to),
            selectinload(BookingDropOff.converted_appointment),
        )
        .where(BookingDropOff.id == lead_id)
    )
    return result.scalar_one_or_none()


async def update_lead(
    db: AsyncSession,
    lead_id: uuid.UUID,
    status: Optional[LeadStatus] = None,
    assigned_to_id: Optional[uuid.UUID] = None,
    crm_notes: Optional[str] = None,
    converted_appointment_id: Optional[uuid.UUID] = None,
    follow_up_at: Optional[datetime] = None,
    priority_score: Optional[int] = None,
    current_user_id: Optional[uuid.UUID] = None,
    log_activity: bool = True,
) -> Optional[BookingDropOff]:
    """
    Update lead with optional activity logging.
    
    Args:
        db: Database session
        lead_id: Lead UUID
        status: New status value
        assigned_to_id: Assignment to admin user
        crm_notes: CRM notes text
        converted_appointment_id: Linked appointment if converted
        follow_up_at: Scheduled follow-up datetime
        priority_score: Lead priority score
        current_user_id: ID of user making the change (for activity log)
        log_activity: Whether to log changes to activity table
        
    Returns:
        Updated lead or None if not found
    """
    lead = await get_lead_by_id(db, lead_id)
    if not lead:
        return None
    
    now = datetime.now(timezone.utc)
    
    # Track status changes
    if status is not None and status != lead.status:
        old_status = lead.status
        lead.status = status
        
        # Track first/last contacted timestamps
        if status in [LeadStatus.CONTACTED, LeadStatus.FOLLOW_UP]:
            if lead.first_contacted_at is None:
                lead.first_contacted_at = now
            lead.last_contacted_at = now
        
        if log_activity:
            await log_lead_activity(
                db,
                lead_id=lead_id,
                activity_type=LeadActivityType.STATUS_CHANGED,
                previous_value=old_status.value,
                new_value=status.value,
                performed_by_id=current_user_id,
            )
    
    # Track assignment changes
    if assigned_to_id is not None and assigned_to_id != lead.assigned_to_id:
        old_assigned = lead.assigned_to_id
        lead.assigned_to_id = assigned_to_id
        
        if log_activity:
            if assigned_to_id is None:
                activity_type = LeadActivityType.UNASSIGNED
            elif old_assigned is None:
                activity_type = LeadActivityType.ASSIGNED
            else:
                activity_type = LeadActivityType.REASSIGNED
            
            await log_lead_activity(
                db,
                lead_id=lead_id,
                activity_type=activity_type,
                previous_value=str(old_assigned) if old_assigned else None,
                new_value=str(assigned_to_id),
                performed_by_id=current_user_id,
            )
    
    # Track notes changes
    if crm_notes is not None and crm_notes != lead.crm_notes:
        lead.crm_notes = crm_notes
        if log_activity:
            await log_lead_activity(
                db,
                lead_id=lead_id,
                activity_type=LeadActivityType.NOTE_ADDED,
                notes=crm_notes,
                performed_by_id=current_user_id,
            )
    
    # Track conversion
    if converted_appointment_id is not None:
        lead.converted_appointment_id = converted_appointment_id
        if log_activity:
            await log_lead_activity(
                db,
                lead_id=lead_id,
                activity_type=LeadActivityType.CONVERTED,
                new_value=str(converted_appointment_id),
                performed_by_id=current_user_id,
            )
    
    # Track follow-up scheduling
    if follow_up_at is not None and follow_up_at != lead.follow_up_at:
        old_follow_up = lead.follow_up_at
        lead.follow_up_at = follow_up_at
        if log_activity:
            await log_lead_activity(
                db,
                lead_id=lead_id,
                activity_type=LeadActivityType.FOLLOW_UP_SCHEDULED,
                previous_value=str(old_follow_up) if old_follow_up else None,
                new_value=str(follow_up_at),
                performed_by_id=current_user_id,
            )
    
    # Track priority score changes
    if priority_score is not None and priority_score != lead.priority_score:
        old_score = lead.priority_score
        lead.priority_score = priority_score
        if log_activity:
            await log_lead_activity(
                db,
                lead_id=lead_id,
                activity_type=LeadActivityType.STATUS_CHANGED,
                previous_value=f"priority:{old_score}",
                new_value=f"priority:{priority_score}",
                performed_by_id=current_user_id,
            )
    
    await db.flush()
    return lead


async def log_lead_activity(
    db: AsyncSession,
    lead_id: uuid.UUID,
    activity_type: LeadActivityType,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None,
    notes: Optional[str] = None,
    performed_by_id: Optional[uuid.UUID] = None,
    metadata_json: Optional[str] = None,
) -> LeadActivity:
    """
    Log an activity for a lead.
    
    Args:
        db: Database session
        lead_id: Lead UUID
        activity_type: Type of activity
        previous_value: Previous value (for changes)
        new_value: New value (for changes)
        notes: Additional notes
        performed_by_id: Admin user who performed the action
        metadata_json: Additional metadata as JSON string
        
    Returns:
        Created LeadActivity instance
    """
    activity = LeadActivity(
        lead_id=lead_id,
        activity_type=activity_type,
        previous_value=previous_value,
        new_value=new_value,
        notes=notes,
        performed_by_id=performed_by_id,
        metadata_json=metadata_json,
    )
    db.add(activity)
    await db.flush()
    return activity


async def get_lead_activities(
    db: AsyncSession,
    lead_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[LeadActivity], int]:
    """
    Get all activities for a lead, ordered by most recent first.
    
    Args:
        db: Database session
        lead_id: Lead UUID
        page: Page number
        page_size: Items per page
        
    Returns:
        Tuple of (activities list, total count)
    """
    query = (
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .options(selectinload(LeadActivity.performed_by))
        .order_by(LeadActivity.performed_at.desc())
    )
    
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def bulk_update_leads(
    db: AsyncSession,
    lead_ids: list[uuid.UUID],
    status: Optional[LeadStatus] = None,
    assigned_to_id: Optional[uuid.UUID] = None,
    crm_notes: Optional[str] = None,
    current_user_id: Optional[uuid.UUID] = None,
) -> int:
    """
    Bulk update multiple leads with the same values.
    
    Args:
        db: Database session
        lead_ids: List of lead UUIDs to update
        status: New status value
        assigned_to_id: Assignment to admin user
        crm_notes: CRM notes text
        current_user_id: ID of user making the change
        
    Returns:
        Number of leads updated
    """
    updated_count = 0
    
    for lead_id in lead_ids:
        result = await update_lead(
            db,
            lead_id=lead_id,
            status=status,
            assigned_to_id=assigned_to_id,
            crm_notes=crm_notes,
            current_user_id=current_user_id,
            log_activity=True,
        )
        if result:
            updated_count += 1
    
    return updated_count


async def create_lead(
    db: AsyncSession,
    phone: str,
    dropped_at_step: str,
    customer_type: CustomerType,
    customer_id: Optional[uuid.UUID] = None,
    selected_service_id: Optional[uuid.UUID] = None,
    selected_slot_id: Optional[uuid.UUID] = None,
    session_started_at: Optional[datetime] = None,
    assigned_to_id: Optional[uuid.UUID] = None,
    priority_score: Optional[int] = None,
    log_activity: bool = True,
    current_user_id: Optional[uuid.UUID] = None,
) -> BookingDropOff:
    """
    Create a new lead with optional activity logging.
    
    Args:
        db: Database session
        phone: Customer phone number
        dropped_at_step: Booking step where user dropped off
        customer_type: Classification of customer
        customer_id: Optional linked customer
        selected_service_id: Optional selected service
        selected_slot_id: Optional selected slot
        session_started_at: When the booking session started
        assigned_to_id: Optional initial assignment
        priority_score: Optional priority score
        log_activity: Whether to log creation activity
        current_user_id: ID of user creating the lead
        
    Returns:
        Created BookingDropOff instance
    """
    now = datetime.now(timezone.utc)
    
    drop_off = BookingDropOff(
        phone=phone,
        customer_id=customer_id,
        dropped_at_step=dropped_at_step,
        customer_type=customer_type,
        selected_service_id=selected_service_id,
        selected_slot_id=selected_slot_id,
        session_started_at=session_started_at,
        dropped_at=now,
        status=LeadStatus.NEW_LEAD,
        assigned_to_id=assigned_to_id,
        priority_score=priority_score or 0,
    )
    db.add(drop_off)
    await db.flush()
    
    if log_activity:
        await log_lead_activity(
            db,
            lead_id=drop_off.id,
            activity_type=LeadActivityType.CREATED,
            new_value=LeadStatus.NEW_LEAD.value,
            performed_by_id=current_user_id,
            metadata_json=f'{{"customer_type": "{customer_type.value}", "dropped_at_step": "{dropped_at_step}"}}',
        )
    
    return drop_off
