import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.time_slot import TimeSlot
from app.models.appointment import Appointment, AppointmentStatus
from app.models.provider import provider_service_map


async def get_available_slots(
    db: AsyncSession, service_id: uuid.UUID, limit: int = 10
) -> list[TimeSlot]:
    """
    Return upcoming available slots for a service, deduplicated by start_time.

    A start_time is available when at least one provider:
      - offers the service (via provider_service_map)
      - has an unbooked slot at that time
      - does NOT have a confirmed appointment whose time window overlaps start_time
        (cross-service: a provider busy with any confirmed booking is unavailable)
    """
    now = datetime.now(timezone.utc)

    # 1. Providers that offer this service
    psm_result = await db.execute(
        select(provider_service_map.c.provider_id).where(
            provider_service_map.c.service_id == service_id
        )
    )
    provider_ids = [row.provider_id for row in psm_result.all()]
    if not provider_ids:
        return []

    # 2. Open slots for those providers in the future
    open_result = await db.execute(
        select(TimeSlot)
        .where(
            TimeSlot.provider_id.in_(provider_ids),
            TimeSlot.is_booked == False,  # noqa: E712
            TimeSlot.start_time > now,
        )
        .order_by(TimeSlot.start_time, TimeSlot.provider_id)
    )
    all_open = list(open_result.scalars().all())
    if not all_open:
        return []

    # 3. All confirmed future appointments for these providers (for overlap check)
    occupied_result = await db.execute(
        select(Appointment.provider_id, TimeSlot.start_time, TimeSlot.end_time)
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .where(
            Appointment.provider_id.in_(provider_ids),
            Appointment.status == AppointmentStatus.CONFIRMED,
            TimeSlot.end_time > now,
        )
    )
    occupied_appts = occupied_result.all()

    # 4. Group open slots by start_time
    slots_by_time: dict[datetime, list[TimeSlot]] = defaultdict(list)
    for slot in all_open:
        slots_by_time[slot.start_time].append(slot)

    # 5. For each start_time, keep it only if at least one provider is free
    unique: list[TimeSlot] = []
    for start_time in sorted(slots_by_time.keys()):
        candidates = slots_by_time[start_time]
        occupied_at = {
            row.provider_id
            for row in occupied_appts
            if row.start_time <= start_time < row.end_time
        }
        if any(s.provider_id not in occupied_at for s in candidates):
            unique.append(candidates[0])
        if len(unique) >= limit:
            break

    return unique


async def get_slot_by_id(db: AsyncSession, slot_id: uuid.UUID) -> TimeSlot | None:
    stmt = select(TimeSlot).where(TimeSlot.id == slot_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def reserve_provider_slot(
    db: AsyncSession,
    service_id: uuid.UUID,
    start_time: datetime,
) -> tuple[TimeSlot, uuid.UUID] | None:
    """
    Atomically reserve one provider slot at start_time for the given service.

    1. Find providers offering the service with an unbooked slot at start_time.
    2. Lock with SELECT FOR UPDATE NOWAIT.
    3. Exclude providers occupied by an overlapping confirmed appointment.
    4. Pick least-loaded eligible provider.
    5. Mark slot booked.
    """
    # 1. Providers offering this service
    psm_result = await db.execute(
        select(provider_service_map.c.provider_id).where(
            provider_service_map.c.service_id == service_id
        )
    )
    provider_ids = [row.provider_id for row in psm_result.all()]
    if not provider_ids:
        return None

    # 2. Open slots for those providers at start_time — lock them
    stmt = (
        select(TimeSlot)
        .where(
            TimeSlot.provider_id.in_(provider_ids),
            TimeSlot.start_time == start_time,
            TimeSlot.is_booked == False,  # noqa: E712
        )
        .with_for_update(nowait=True)
    )
    result = await db.execute(stmt)
    candidates = list(result.scalars().all())
    if not candidates:
        return None

    candidate_provider_ids = [c.provider_id for c in candidates]

    # 3. Overlap check — exclude providers already occupied at start_time
    overlap_result = await db.execute(
        select(Appointment.provider_id)
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .where(
            Appointment.provider_id.in_(candidate_provider_ids),
            Appointment.status == AppointmentStatus.CONFIRMED,
            TimeSlot.start_time <= start_time,
            TimeSlot.end_time > start_time,
        )
    )
    occupied: set[uuid.UUID] = {row.provider_id for row in overlap_result.all()}

    eligible = [c for c in candidates if c.provider_id not in occupied]
    if not eligible:
        return None

    # 4. Load-balance — pick provider with fewest future confirmed appointments
    eligible_ids = [c.provider_id for c in eligible]
    load_result = await db.execute(
        select(Appointment.provider_id, func.count(Appointment.id).label("load"))
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .where(
            Appointment.provider_id.in_(eligible_ids),
            Appointment.status == AppointmentStatus.CONFIRMED,
            TimeSlot.start_time >= datetime.now(timezone.utc),
        )
        .group_by(Appointment.provider_id)
    )
    load_map: dict[uuid.UUID, int] = {row.provider_id: row.load for row in load_result.all()}

    chosen = min(eligible, key=lambda s: (load_map.get(s.provider_id, 0), s.provider_id))

    # 5. Mark booked
    chosen.is_booked = True
    chosen.booked_at = datetime.now(timezone.utc)

    return chosen, chosen.provider_id


async def mark_slot_booked(db: AsyncSession, slot_id: uuid.UUID) -> TimeSlot | None:
    stmt = (
        select(TimeSlot)
        .where(TimeSlot.id == slot_id, TimeSlot.is_booked == False)  # noqa: E712
        .with_for_update(nowait=True)
    )
    result = await db.execute(stmt)
    slot = result.scalar_one_or_none()
    if slot is None:
        return None
    slot.is_booked = True
    slot.booked_at = datetime.now(timezone.utc)
    return slot


async def release_provider_slot(db: AsyncSession, slot_id: uuid.UUID) -> None:
    slot = await db.get(TimeSlot, slot_id)
    if slot is not None:
        slot.is_booked = False
        slot.booked_at = None
