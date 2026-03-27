"""
Seed script for admin CRM data.
Run AFTER seed.py (which creates services and slots).

Usage:
    python seed_admin.py
"""
import asyncio
import logging

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.admin_user import AdminUser, AdminRole
from app.models.provider import Provider, provider_service_map
from app.models.customer import Customer
from app.models.service import Service
from app.core.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ADMIN_USERS = [
    {"email": "admin@clinic.com",      "password": "admin1234",      "name": "Admin User",   "role": AdminRole.ADMIN},
    {"email": "manager@clinic.com",    "password": "manager1234",    "name": "Dr. Manager",  "role": AdminRole.MANAGER},
    {"email": "reception@clinic.com",  "password": "reception1234",  "name": "Reception",    "role": AdminRole.RECEPTIONIST},
]

PROVIDERS = [
    {"name": "Dr. Sarah Johnson", "email": "sarah@clinic.com",   "phone": "+1234567890"},
    {"name": "Dr. Michael Chen",  "email": "michael@clinic.com", "phone": "+1234567891"},
]

CUSTOMERS = [
    {"phone": "+19995550001", "name": "Alice Smith",    "email": "alice@example.com"},
    {"phone": "+19995550002", "name": "Bob Jones",      "email": "bob@example.com"},
    {"phone": "+19995550003", "name": "Carol White",    "email": None},
    {"phone": "+19995550004", "name": "David Brown",    "email": "david@example.com"},
    {"phone": "+19995550005", "name": "Eva Martinez",   "email": None},
]


async def seed():
    import app.db.base  # noqa: F401 — registers all models
    async with AsyncSessionLocal() as db:
        # Admin users
        for u in ADMIN_USERS:
            existing = await db.execute(select(AdminUser).where(AdminUser.email == u["email"]))
            if existing.scalar_one_or_none() is None:
                db.add(AdminUser(
                    email=u["email"],
                    hashed_password=hash_password(u["password"]),
                    name=u["name"],
                    role=u["role"],
                ))
                logger.info("Created admin: %s (%s)", u["email"], u["role"].value)
            else:
                logger.info("Admin already exists: %s", u["email"])

        await db.flush()

        # Providers
        created_providers = []
        for p in PROVIDERS:
            existing = await db.execute(select(Provider).where(Provider.name == p["name"]))
            provider = existing.scalar_one_or_none()
            if provider is None:
                provider = Provider(name=p["name"], email=p["email"], phone=p["phone"])
                db.add(provider)
                await db.flush()
                logger.info("Created provider: %s", p["name"])
            created_providers.append(provider)

        # Assign all services to both providers
        services_result = await db.execute(select(Service).where(Service.is_active == True))
        services = list(services_result.scalars().all())
        logger.info("Found %d active services to assign", len(services))

        for provider in created_providers:
            for service in services:
                # Check if already assigned
                existing = await db.execute(
                    select(provider_service_map).where(
                        provider_service_map.c.provider_id == provider.id,
                        provider_service_map.c.service_id == service.id,
                    )
                )
                if existing.first() is None:
                    await db.execute(
                        provider_service_map.insert().values(
                            provider_id=provider.id, service_id=service.id
                        )
                    )

        await db.flush()

        # Customers
        for c in CUSTOMERS:
            existing = await db.execute(select(Customer).where(Customer.phone == c["phone"]))
            if existing.scalar_one_or_none() is None:
                db.add(Customer(phone=c["phone"], name=c["name"], email=c["email"]))
                logger.info("Created customer: %s (%s)", c["name"], c["phone"])
            else:
                logger.info("Customer already exists: %s", c["phone"])

        await db.commit()
        logger.info("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
