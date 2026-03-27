import uuid
from datetime import date
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.provider import Provider, provider_service_map
from app.models.time_slot import TimeSlot
from app.models.service import Service


async def get_by_id(db: AsyncSession, provider_id: uuid.UUID) -> Provider | None:
    result = await db.execute(
        select(Provider).options(selectinload(Provider.services)).where(Provider.id == provider_id)
    )
    return result.scalar_one_or_none()


async def list_providers(db: AsyncSession, active_only: bool = True) -> list[Provider]:
    query = select(Provider).options(selectinload(Provider.services))
    if active_only:
        query = query.where(Provider.is_active == True)
    query = query.order_by(Provider.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_provider(
    db: AsyncSession,
    name: str,
    email: str | None = None,
    phone: str | None = None,
) -> Provider:
    provider = Provider(name=name, email=email, phone=phone)
    db.add(provider)
    await db.flush()
    return provider


async def update_provider(db: AsyncSession, provider_id: uuid.UUID, **kwargs) -> Provider | None:
    provider = await get_by_id(db, provider_id)
    if not provider:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(provider, key, value)
    await db.flush()
    return provider


async def assign_service(db: AsyncSession, provider_id: uuid.UUID, service_id: uuid.UUID) -> bool:
    # Check if already assigned
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
    # Get service IDs for this provider
    provider = await get_by_id(db, provider_id)
    if not provider:
        return []
    service_ids = [s.id for s in provider.services]
    if not service_ids:
        return []
    from datetime import datetime, timezone
    query = select(TimeSlot).where(
        TimeSlot.service_id.in_(service_ids),
        TimeSlot.start_time >= datetime.now(timezone.utc),
    )
    if filter_date:
        from datetime import timedelta
        day_start = datetime(filter_date.year, filter_date.month, filter_date.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        query = query.where(TimeSlot.start_time >= day_start, TimeSlot.start_time < day_end)
    query = query.order_by(TimeSlot.start_time)
    result = await db.execute(query)
    return list(result.scalars().all())
