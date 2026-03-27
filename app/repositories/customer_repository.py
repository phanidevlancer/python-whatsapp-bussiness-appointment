import uuid
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.customer import Customer
from app.models.appointment import Appointment


def normalize_phone(phone: str) -> str:
    """Normalize phone number by removing + prefix and leading zeros."""
    return phone.lstrip('+').lstrip('0')


async def get_by_phone(db: AsyncSession, phone: str) -> Customer | None:
    normalized = normalize_phone(phone)
    result = await db.execute(
        select(Customer).where(
            or_(
                Customer.phone == normalized,
                Customer.phone == '+' + normalized,
            )
        )
    )
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, customer_id: uuid.UUID) -> Customer | None:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    return result.scalar_one_or_none()


async def get_or_create_by_phone(db: AsyncSession, phone: str) -> tuple[Customer, bool]:
    customer = await get_by_phone(db, phone)
    if customer:
        return customer, False
    # Store phone in normalized format (without +)
    customer = Customer(phone=normalize_phone(phone))
    db.add(customer)
    await db.flush()
    return customer, True


async def create_customer(
    db: AsyncSession,
    phone: str,
    name: str | None = None,
    email: str | None = None,
    notes: str | None = None,
) -> Customer:
    customer = Customer(phone=phone, name=name, email=email, notes=notes)
    db.add(customer)
    await db.flush()
    return customer


async def update_customer(db: AsyncSession, customer_id: uuid.UUID, **kwargs) -> Customer | None:
    customer = await get_by_id(db, customer_id)
    if not customer:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(customer, key, value)
    await db.flush()
    return customer


async def list_customers(
    db: AsyncSession,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Customer], int]:
    query = select(Customer)
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(Customer.phone.ilike(like), Customer.name.ilike(like), Customer.email.ilike(like))
        )
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    query = query.order_by(Customer.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_customer_appointments(
    db: AsyncSession,
    customer_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Appointment], int]:
    from sqlalchemy.orm import selectinload
    query = select(Appointment).where(Appointment.customer_id == customer_id)
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    query = (
        query.options(
            selectinload(Appointment.service),
            selectinload(Appointment.slot),
            selectinload(Appointment.provider),
        )
        .order_by(Appointment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    return list(result.scalars().all()), total
