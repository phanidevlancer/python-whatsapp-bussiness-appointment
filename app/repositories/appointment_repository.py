import uuid

from sqlalchemy.ext.asyncio import AsyncSession

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
