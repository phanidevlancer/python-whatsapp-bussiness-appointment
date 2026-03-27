import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Service


async def get_active_services(db: AsyncSession) -> list[Service]:
    """Return all active services ordered by name."""
    stmt = select(Service).where(Service.is_active == True).order_by(Service.name)  # noqa: E712
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_service_by_id(db: AsyncSession, service_id: uuid.UUID) -> Service | None:
    """Return a single service by ID, or None if not found."""
    stmt = select(Service).where(Service.id == service_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
