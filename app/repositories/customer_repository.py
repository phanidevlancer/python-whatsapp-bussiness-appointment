import uuid
from datetime import datetime, timedelta, timezone
import re

from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.customer import Customer
from app.models.appointment import Appointment


def normalize_phone(phone: str) -> str:
    """Normalize phone number by removing formatting characters and one trunk zero when safe."""
    digits = re.sub(r"\D", "", phone.strip())
    if digits.startswith("0") and 11 <= len(digits) <= 13:
        return digits[1:]
    return digits


def _normalized_phone_sql(column):
    digits = func.regexp_replace(func.trim(column), r"[^0-9]", "", "g")
    return case(
        (
            func.length(digits).between(11, 13),
            case(
                (func.substr(digits, 1, 1) == "0", func.substr(digits, 2)),
                else_=digits,
            ),
        ),
        else_=digits,
    )


async def get_by_phone(db: AsyncSession, phone: str) -> Customer | None:
    normalized = normalize_phone(phone)
    # First try to find exact normalized match (without +)
    result = await db.execute(select(Customer).where(Customer.phone == normalized))
    customer = result.scalar_one_or_none()
    if customer:
        return customer
    # Then try with + prefix
    result = await db.execute(select(Customer).where(Customer.phone == '+' + normalized))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, customer_id: uuid.UUID) -> Customer | None:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    return result.scalar_one_or_none()


async def get_or_create_by_phone(
    db: AsyncSession,
    phone: str,
    whatsapp_name: str | None = None,
) -> tuple[Customer, bool]:
    customer = await get_by_phone(db, phone)
    if customer:
        # Silently backfill name from WhatsApp profile if not yet set
        if whatsapp_name and not customer.name:
            customer.name = whatsapp_name
            await db.flush()
        return customer, False
    customer = Customer(phone=normalize_phone(phone), name=whatsapp_name)
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


async def list_contactable_customers(db: AsyncSession) -> list[Customer]:
    query = (
        select(Customer)
        .where(func.length(func.trim(Customer.phone)) > 0)
        .order_by(Customer.created_at.asc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_customers_with_previous_bookings(db: AsyncSession) -> list[Customer]:
    normalized_customer_phone = _normalized_phone_sql(Customer.phone)
    normalized_appointment_phone = _normalized_phone_sql(Appointment.user_phone)
    has_booking = exists(
        select(1).where(
            or_(
                Appointment.customer_id == Customer.id,
                normalized_appointment_phone == normalized_customer_phone,
            )
        )
    ).correlate(Customer)

    query = select(Customer).where(has_booking).order_by(Customer.created_at.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_customers_inactive_for_days(
    db: AsyncSession,
    inactive_days: int,
    *,
    now: datetime | None = None,
) -> list[Customer]:
    if inactive_days <= 0:
        raise ValueError("inactive_days must be greater than 0")

    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=inactive_days)

    normalized_customer_phone = _normalized_phone_sql(Customer.phone)
    normalized_appointment_phone = _normalized_phone_sql(Appointment.user_phone)
    latest_booking_at = (
        select(func.max(Appointment.booked_at))
        .where(
            or_(
                Appointment.customer_id == Customer.id,
                normalized_appointment_phone == normalized_customer_phone,
            )
        )
        .correlate(Customer)
        .scalar_subquery()
    )

    query = (
        select(Customer)
        .where(latest_booking_at.is_not(None))
        .where(latest_booking_at <= cutoff)
        .order_by(Customer.created_at.asc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_customer_appointments(
    db: AsyncSession,
    customer_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Appointment], int]:
    from sqlalchemy.orm import selectinload
    customer = await get_by_id(db, customer_id)
    if customer is None:
        return [], 0

    normalized_phone = normalize_phone(customer.phone)
    phone_variants = [normalized_phone, '+' + normalized_phone]

    query = select(Appointment).where(
        or_(
            Appointment.customer_id == customer_id,
            Appointment.customer_id.is_(None) & Appointment.user_phone.in_(phone_variants),
        )
    )
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    query = (
        query.options(
            selectinload(Appointment.service),
            selectinload(Appointment.slot),
            selectinload(Appointment.provider),
            selectinload(Appointment.customer),
        )
        .order_by(Appointment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    return list(result.scalars().all()), total
