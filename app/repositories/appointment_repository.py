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
        .options(selectinload(Appointment.slot))
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
