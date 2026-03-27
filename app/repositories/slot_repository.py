import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.time_slot import TimeSlot


async def get_available_slots(
    db: AsyncSession, service_id: uuid.UUID, limit: int = 10
) -> list[TimeSlot]:
    """
    Return upcoming unbooked slots for a service.
    Limited to `limit` rows (WhatsApp interactive list max = 10 rows per section).
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(TimeSlot)
        .where(
            TimeSlot.service_id == service_id,
            TimeSlot.is_booked == False,  # noqa: E712
            TimeSlot.start_time > now,
        )
        .order_by(TimeSlot.start_time)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_slot_by_id(db: AsyncSession, slot_id: uuid.UUID) -> TimeSlot | None:
    """Return a slot by ID, or None."""
    stmt = select(TimeSlot).where(TimeSlot.id == slot_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def mark_slot_booked(db: AsyncSession, slot_id: uuid.UUID) -> TimeSlot | None:
    """
    Atomically mark a slot as booked using SELECT FOR UPDATE NOWAIT.

    - NOWAIT: raises sqlalchemy.exc.OperationalError immediately if another
      transaction already holds a row lock (no waiting/deadlock risk).
    - Returns None if the slot is already booked or doesn't exist.
    - Caller must handle OperationalError for the concurrent-booking case.
    """
    stmt = (
        select(TimeSlot)
        .where(TimeSlot.id == slot_id, TimeSlot.is_booked == False)  # noqa: E712
        .with_for_update(nowait=True)
    )
    result = await db.execute(stmt)
    slot = result.scalar_one_or_none()

    if slot is None:
        return None  # Already booked or not found

    slot.is_booked = True
    slot.booked_at = datetime.now(timezone.utc)
    return slot
