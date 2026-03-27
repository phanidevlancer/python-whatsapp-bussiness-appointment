import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment, AppointmentStatus


async def create_appointment(
    db: AsyncSession,
    user_phone: str,
    service_id: uuid.UUID,
    slot_id: uuid.UUID,
) -> Appointment:
    """
    Create a new confirmed appointment.
    flush() writes to DB within the current transaction without committing —
    the commit happens in get_db() when the request completes successfully.
    """
    appointment = Appointment(
        user_phone=user_phone,
        service_id=service_id,
        slot_id=slot_id,
        status=AppointmentStatus.CONFIRMED,
    )
    db.add(appointment)
    await db.flush()  # Get the generated ID before commit
    return appointment


async def get_upcoming_appointments(
    db: AsyncSession, user_phone: str
) -> list[Appointment]:
    """
    Return all confirmed upcoming appointments for a user, ordered by slot start time.
    Eagerly loads service and slot relationships to avoid lazy-load issues.
    """
    from app.models.time_slot import TimeSlot  # local import to avoid circular

    now = datetime.now(timezone.utc)
    stmt = (
        select(Appointment)
        .options(selectinload(Appointment.service), selectinload(Appointment.slot))
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .where(
            Appointment.user_phone == user_phone,
            Appointment.status == AppointmentStatus.CONFIRMED,
            TimeSlot.start_time > now,
        )
        .order_by(TimeSlot.start_time)
        .limit(10)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_appointment_by_id(
    db: AsyncSession, appointment_id: uuid.UUID
) -> Appointment | None:
    """Return a single appointment with service and slot loaded."""
    stmt = (
        select(Appointment)
        .options(selectinload(Appointment.service), selectinload(Appointment.slot))
        .where(Appointment.id == appointment_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def cancel_appointment(
    db: AsyncSession, appointment_id: uuid.UUID
) -> Appointment | None:
    """
    Cancel an appointment and free the associated time slot.
    Returns the updated appointment, or None if not found / already cancelled.
    """
    from app.models.time_slot import TimeSlot  # local import to avoid circular

    stmt = (
        select(Appointment)
        .options(selectinload(Appointment.service), selectinload(Appointment.slot))
        .where(
            Appointment.id == appointment_id,
            Appointment.status == AppointmentStatus.CONFIRMED,
        )
    )
    result = await db.execute(stmt)
    appointment = result.scalar_one_or_none()

    if appointment is None:
        return None

    appointment.status = AppointmentStatus.CANCELLED

    # Free the slot so others can book it
    slot = appointment.slot
    if slot is not None:
        slot.is_booked = False
        slot.booked_at = None

    return appointment


# ─── CRM Extensions ────────────────────────────────────────────────────────

async def list_appointments_crm(
    db: AsyncSession,
    date_from=None,
    date_to=None,
    status=None,
    service_id=None,
    provider_id=None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple:
    from sqlalchemy import func, or_
    from datetime import datetime, timezone, timedelta
    from app.models.customer import Customer

    query = (
        select(Appointment)
        .options(
            selectinload(Appointment.service),
            selectinload(Appointment.slot),
            selectinload(Appointment.provider),
            selectinload(Appointment.customer),
        )
    )
    if date_from:
        day_start = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc)
        query = query.where(Appointment.created_at >= day_start)
    if date_to:
        day_end = datetime(date_to.year, date_to.month, date_to.day, tzinfo=timezone.utc) + timedelta(days=1)
        query = query.where(Appointment.created_at < day_end)
    if status:
        query = query.where(Appointment.status == status)
    if service_id:
        query = query.where(Appointment.service_id == service_id)
    if provider_id:
        query = query.where(Appointment.provider_id == provider_id)
    if search:
        like = f"%{search}%"
        query = query.join(Customer, Appointment.customer_id == Customer.id, isouter=True).where(
            or_(Appointment.user_phone.ilike(like), Customer.name.ilike(like))
        )

    count_q = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_q)
    total = count_result.scalar_one()
    query = query.order_by(Appointment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def create_appointment_crm(
    db: AsyncSession,
    user_phone: str,
    service_id: uuid.UUID,
    slot_id: uuid.UUID,
    provider_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> Appointment:
    appointment = Appointment(
        user_phone=user_phone,
        service_id=service_id,
        slot_id=slot_id,
        provider_id=provider_id,
        customer_id=customer_id,
        notes=notes,
        status=AppointmentStatus.CONFIRMED,
    )
    db.add(appointment)
    await db.flush()
    return appointment


async def get_appointment_history(db: AsyncSession, appointment_id: uuid.UUID) -> list:
    from app.models.appointment_status_history import AppointmentStatusHistory
    result = await db.execute(
        select(AppointmentStatusHistory)
        .where(AppointmentStatusHistory.appointment_id == appointment_id)
        .order_by(AppointmentStatusHistory.created_at)
    )
    return list(result.scalars().all())


async def update_appointment_fields(db: AsyncSession, appointment_id: uuid.UUID, **kwargs) -> Appointment | None:
    stmt = (
        select(Appointment)
        .options(
            selectinload(Appointment.service),
            selectinload(Appointment.slot),
            selectinload(Appointment.provider),
            selectinload(Appointment.customer),
        )
        .where(Appointment.id == appointment_id)
    )
    result = await db.execute(stmt)
    appointment = result.scalar_one_or_none()
    if not appointment:
        return None
    for key, value in kwargs.items():
        setattr(appointment, key, value)
    await db.flush()
    return appointment


async def get_appointment_crm_by_id(db: AsyncSession, appointment_id: uuid.UUID) -> Appointment | None:
    stmt = (
        select(Appointment)
        .options(
            selectinload(Appointment.service),
            selectinload(Appointment.slot),
            selectinload(Appointment.provider),
            selectinload(Appointment.customer),
        )
        .where(Appointment.id == appointment_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
