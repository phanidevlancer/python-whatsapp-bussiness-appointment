"""
Seed script: admin credentials, services, providers (with slots), and customers.

Run AFTER alembic upgrade head AND python -m app.db.seed (which seeds permissions/roles).

Usage:
    python seed_admin.py
"""
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.admin_user import AdminUser, AdminRole
from app.models.provider import Provider, provider_service_map
from app.models.customer import Customer
from app.models.service import Service
from app.core.security import hash_password
from app.repositories.provider_repository import generate_slots_for_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ADMIN_USERS = [
    {"email": "admin@clinic.com",     "password": "admin1234",     "name": "Admin User",  "role": AdminRole.ADMIN},
    {"email": "manager@clinic.com",   "password": "manager1234",   "name": "Dr. Manager", "role": AdminRole.MANAGER},
    {"email": "reception@clinic.com", "password": "reception1234", "name": "Reception",   "role": AdminRole.RECEPTIONIST},
]

SERVICES = [
    {"name": "Hair Transplantation",   "description": "Hair transplantation procedure",       "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Laser Hair Removal",     "description": "Laser-based hair removal treatment",   "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Laser Skin Toning",      "description": "Laser skin toning and rejuvenation",   "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Anti-Ageing Treatment",  "description": "Anti-ageing skin care treatment",      "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Skin Lightening",        "description": "Skin lightening and brightening",      "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Dark Circle Treatment",  "description": "Under-eye dark circle treatment",      "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Hair Loss Treatment",    "description": "Hair loss and thinning treatment",     "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Skin Rejuvenation",      "description": "Skin rejuvenation and glow therapy",   "duration_minutes": 20, "cost": Decimal("0.00")},
    {"name": "Hydra Facial",           "description": "Hydrating facial skin treatment",      "duration_minutes": 20, "cost": Decimal("0.00")},
]

# Providers — each gets slots auto-generated (90 days, 10am–8pm IST, weekdays)
PROVIDERS = [
    {"name": "Dr. Sarah Johnson", "email": "sarah@clinic.com",   "phone": "+1234567890", "role": "doctor",         "slot_duration_minutes": 20},
    {"name": "Dr. Michael Chen",  "email": "michael@clinic.com", "phone": "+1234567891", "role": "doctor",         "slot_duration_minutes": 20},
    {"name": "Dr. Priya Sharma",  "email": "priya@clinic.com",   "phone": "+1234567892", "role": "dermatologist",  "slot_duration_minutes": 20},
]

CUSTOMERS = [
    {"phone": "+19995550001", "name": "Alice Smith",  "email": "alice@example.com"},
    {"phone": "+19995550002", "name": "Bob Jones",    "email": "bob@example.com"},
    {"phone": "+19995550003", "name": "Carol White",  "email": None},
]


async def seed():
    import app.db.base  # noqa: F401 — registers all models
    async with AsyncSessionLocal() as db:

        # ── 1. Admin users ────────────────────────────────────────────────────
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

        # ── 2. Services ───────────────────────────────────────────────────────
        service_objects: list[Service] = []
        for s in SERVICES:
            existing = await db.execute(select(Service).where(Service.name == s["name"]))
            service = existing.scalar_one_or_none()
            if service is None:
                service = Service(
                    name=s["name"],
                    description=s["description"],
                    duration_minutes=s["duration_minutes"],
                    cost=s["cost"],
                    is_active=True,
                )
                db.add(service)
                await db.flush()
                logger.info("Created service: %s", s["name"])
            else:
                logger.info("Service already exists: %s", s["name"])
            service_objects.append(service)

        # ── 3. Providers + service assignment + slot generation ───────────────
        for p in PROVIDERS:
            existing = await db.execute(select(Provider).where(Provider.email == p["email"]))
            provider = existing.scalar_one_or_none()
            if provider is None:
                provider = Provider(
                    name=p["name"],
                    email=p["email"],
                    phone=p["phone"],
                    role=p["role"],
                    slot_duration_minutes=p["slot_duration_minutes"],
                    is_active=True,
                )
                db.add(provider)
                await db.flush()
                logger.info("Created provider: %s", p["name"])
            else:
                logger.info("Provider already exists: %s", p["name"])

            # Assign all services to provider (idempotent)
            for service in service_objects:
                existing_map = await db.execute(
                    select(provider_service_map).where(
                        provider_service_map.c.provider_id == provider.id,
                        provider_service_map.c.service_id == service.id,
                    )
                )
                if existing_map.first() is None:
                    await db.execute(
                        provider_service_map.insert().values(
                            provider_id=provider.id, service_id=service.id
                        )
                    )

            # Generate slots for this provider
            count = await generate_slots_for_provider(
                db, provider.id, slot_duration_minutes=p["slot_duration_minutes"]
            )
            logger.info("Generated %d slots for %s", count, p["name"])

        await db.flush()

        # ── 4. Customers ──────────────────────────────────────────────────────
        for c in CUSTOMERS:
            existing = await db.execute(select(Customer).where(Customer.phone == c["phone"]))
            if existing.scalar_one_or_none() is None:
                db.add(Customer(phone=c["phone"], name=c["name"], email=c["email"]))
                logger.info("Created customer: %s (%s)", c["name"], c["phone"])

        await db.commit()
        logger.info("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
