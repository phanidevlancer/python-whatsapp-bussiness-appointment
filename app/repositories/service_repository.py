import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Service
from app.models.provider import provider_service_map


async def get_active_services(db: AsyncSession) -> list[Service]:
    """Return all active services ordered by name."""
    stmt = select(Service).where(Service.is_active == True).order_by(Service.name)  # noqa: E712
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_active_services_with_providers(db: AsyncSession) -> list[Service]:
    """Return only active services that have at least one provider with a free future slot.
    This is the WhatsApp booking filter — only show services the user can actually book."""
    from app.models.time_slot import TimeSlot
    from app.models.appointment import Appointment, AppointmentStatus
    now = datetime.now(timezone.utc)

    # Get all active services that have at least one provider assigned
    services_result = await db.execute(
        select(Service)
        .where(Service.is_active == True)  # noqa: E712
        .where(
            select(func.count())
            .select_from(provider_service_map)
            .where(provider_service_map.c.service_id == Service.id)
            .correlate(Service)
            .scalar_subquery() > 0
        )
        .order_by(Service.name)
    )
    services = list(services_result.scalars().all())
    if not services:
        return []

    # For each service, check at least one provider has a free unoccupied slot
    available = []
    for service in services:
        # Providers for this service
        psm_result = await db.execute(
            select(provider_service_map.c.provider_id).where(
                provider_service_map.c.service_id == service.id
            )
        )
        provider_ids = [row.provider_id for row in psm_result.all()]
        if not provider_ids:
            continue

        # Find any open future slot for these providers that isn't overlap-blocked
        open_result = await db.execute(
            select(TimeSlot.start_time, TimeSlot.provider_id)
            .where(
                TimeSlot.provider_id.in_(provider_ids),
                TimeSlot.is_booked == False,  # noqa: E712
                TimeSlot.start_time > now,
            )
            .order_by(TimeSlot.start_time)
            .limit(50)
        )
        open_slots = open_result.all()
        if not open_slots:
            continue

        # Get confirmed appointments for these providers
        occupied_result = await db.execute(
            select(Appointment.provider_id, TimeSlot.start_time, TimeSlot.end_time)
            .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
            .where(
                Appointment.provider_id.in_(provider_ids),
                Appointment.status == AppointmentStatus.CONFIRMED,
                TimeSlot.end_time > now,
            )
        )
        occupied = occupied_result.all()

        # Check if any open slot has a free provider
        has_free = False
        for slot_row in open_slots:
            occupied_at = {
                row.provider_id for row in occupied
                if row.start_time <= slot_row.start_time < row.end_time
            }
            if slot_row.provider_id not in occupied_at:
                has_free = True
                break

        if has_free:
            available.append(service)

    return available


async def get_service_by_id(db: AsyncSession, service_id: uuid.UUID) -> Service | None:
    stmt = select(Service).where(Service.id == service_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_provider_count_for_service(db: AsyncSession, service_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(provider_service_map).where(
            provider_service_map.c.service_id == service_id
        )
    )
    return result.scalar_one() or 0


async def get_providers_for_service(db: AsyncSession, service_id: uuid.UUID) -> list:
    """Return Provider rows assigned to a service, ordered by name."""
    from app.models.provider import Provider
    result = await db.execute(
        select(Provider)
        .join(provider_service_map, provider_service_map.c.provider_id == Provider.id)
        .where(provider_service_map.c.service_id == service_id, Provider.is_active == True)  # noqa: E712
        .order_by(Provider.name)
    )
    return list(result.scalars().all())
