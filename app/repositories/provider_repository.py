import uuid
from datetime import date, datetime, timezone, timedelta
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.provider import Provider, provider_service_map
from app.models.time_slot import TimeSlot

# Slot generation constants (clinic local time = IST, UTC+05:30)
_IST = timezone(timedelta(hours=5, minutes=30))
_SLOT_START_HOUR = 10      # 10:00 AM IST
_SLOT_END_HOUR = 20        # 8:00 PM IST
_SLOT_INTERVAL_MINUTES = 20
_SLOT_DAYS_AHEAD = 90


async def generate_slots_for_provider(
    db: AsyncSession,
    provider_id: uuid.UUID,
    slot_duration_minutes: int = _SLOT_INTERVAL_MINUTES,
) -> int:
    """
    Generate slots for a provider — one slot per time window, no service_id.
    - 90 days ahead from today (IST)
    - 10am–8pm IST, weekdays only (Mon–Fri)
    - Slot interval AND duration = slot_duration_minutes (provider-level, default 20 min)
    - Skips slots that already exist (idempotent)
    Returns the number of new slots created.
    """
    interval = timedelta(minutes=slot_duration_minutes)
    slot_duration = timedelta(minutes=slot_duration_minutes)
    today = datetime.now(_IST).date()
    created = 0

    for day_offset in range(_SLOT_DAYS_AHEAD):
        current_date = today + timedelta(days=day_offset)
        if current_date.weekday() >= 5:  # skip Sat/Sun
            continue

        slot_time = datetime(
            current_date.year, current_date.month, current_date.day,
            _SLOT_START_HOUR, 0, 0, tzinfo=_IST,
        )
        end_of_day = slot_time.replace(hour=_SLOT_END_HOUR, minute=0, second=0)

        while slot_time < end_of_day:
            slot_end = slot_time + slot_duration
            existing = await db.execute(
                select(TimeSlot.id).where(
                    TimeSlot.provider_id == provider_id,
                    TimeSlot.start_time == slot_time,
                )
            )
            if existing.scalar_one_or_none() is None:
                db.add(TimeSlot(
                    provider_id=provider_id,
                    start_time=slot_time,
                    end_time=slot_end,
                ))
                created += 1
            slot_time += interval

    if created:
        await db.flush()
    return created


async def get_by_id(db: AsyncSession, provider_id: uuid.UUID) -> Provider | None:
    result = await db.execute(
        select(Provider).options(selectinload(Provider.services)).where(Provider.id == provider_id)
    )
    return result.scalar_one_or_none()


async def list_providers(db: AsyncSession, active_only: bool = True) -> list[Provider]:
    query = select(Provider).options(selectinload(Provider.services))
    if active_only:
        query = query.where(Provider.is_active == True)  # noqa: E712
    query = query.order_by(Provider.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def replace_provider_services(
    db: AsyncSession, provider_id: uuid.UUID, service_ids: list[uuid.UUID]
) -> None:
    await db.execute(
        delete(provider_service_map).where(provider_service_map.c.provider_id == provider_id)
    )
    for service_id in service_ids:
        await db.execute(
            provider_service_map.insert().values(provider_id=provider_id, service_id=service_id)
        )


async def create_provider(
    db: AsyncSession,
    name: str,
    email: str | None = None,
    phone: str | None = None,
    role: str = "doctor",
    slot_duration_minutes: int = _SLOT_INTERVAL_MINUTES,
    service_ids: list[uuid.UUID] | None = None,
) -> Provider:
    provider = Provider(name=name, email=email, phone=phone, role=role, slot_duration_minutes=slot_duration_minutes)
    db.add(provider)
    await db.flush()
    if service_ids:
        await replace_provider_services(db, provider.id, service_ids)
    await generate_slots_for_provider(db, provider.id, slot_duration_minutes=slot_duration_minutes)
    return await get_by_id(db, provider.id)


async def update_provider(db: AsyncSession, provider_id: uuid.UUID, **kwargs) -> Provider | None:
    service_ids = kwargs.pop("service_ids", None)
    provider = await get_by_id(db, provider_id)
    if not provider:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(provider, key, value)
    await db.flush()
    if service_ids is not None:
        await replace_provider_services(db, provider_id, service_ids)
    return await get_by_id(db, provider_id)


async def assign_service(db: AsyncSession, provider_id: uuid.UUID, service_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(provider_service_map).where(
            provider_service_map.c.provider_id == provider_id,
            provider_service_map.c.service_id == service_id,
        )
    )
    if result.first():
        return False
    await db.execute(
        provider_service_map.insert().values(provider_id=provider_id, service_id=service_id)
    )
    return True


async def remove_service(db: AsyncSession, provider_id: uuid.UUID, service_id: uuid.UUID) -> bool:
    result = await db.execute(
        delete(provider_service_map).where(
            provider_service_map.c.provider_id == provider_id,
            provider_service_map.c.service_id == service_id,
        )
    )
    return result.rowcount > 0


async def get_provider_slots(
    db: AsyncSession,
    provider_id: uuid.UUID,
    filter_date: date | None = None,
) -> list[TimeSlot]:
    query = select(TimeSlot).where(
        TimeSlot.provider_id == provider_id,
        TimeSlot.start_time >= datetime.now(_IST),
    )
    if filter_date:
        day_start = datetime(filter_date.year, filter_date.month, filter_date.day, tzinfo=_IST)
        day_end = day_start + timedelta(days=1)
        query = query.where(TimeSlot.start_time >= day_start, TimeSlot.start_time < day_end)
    query = query.order_by(TimeSlot.start_time)
    result = await db.execute(query)
    return list(result.scalars().all())
