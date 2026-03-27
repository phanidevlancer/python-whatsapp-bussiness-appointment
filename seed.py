"""
Seed script — populates the database with sample services and time slots.

Usage:
    python seed.py

Creates:
- 3 services
- Time slots for each service: 9am–5pm, every 30 min, for the next 7 days
"""
import asyncio
from datetime import datetime, timedelta, timezone

from app.db.session import AsyncSessionLocal
from app.models.service import Service
from app.models.time_slot import TimeSlot


SERVICES = [
    {
        "name": "General Consultation",
        "description": "General health consultation with a doctor",
        "duration_minutes": 30,
    },
    {
        "name": "Dental Checkup",
        "description": "Routine dental examination and cleaning",
        "duration_minutes": 45,
    },
    {
        "name": "Skin Consultation",
        "description": "Dermatology consultation for skin concerns",
        "duration_minutes": 30,
    },
]

# Slot configuration
DAYS_AHEAD = 7        # Generate slots for the next N days
SLOT_INTERVAL = 30    # Minutes between slot start times
DAY_START_HOUR = 9    # 9:00 AM
DAY_END_HOUR = 17     # 5:00 PM (last slot starts before this)


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Create services
        services: list[Service] = []
        for svc_data in SERVICES:
            service = Service(**svc_data)
            db.add(service)
            services.append(service)

        await db.flush()  # Assign IDs before creating slots

        print(f"Created {len(services)} services")

        # Create time slots for each service
        slot_count = 0
        today = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        for service in services:
            for day_offset in range(1, DAYS_AHEAD + 1):
                day = today + timedelta(days=day_offset)
                slot_start = day.replace(hour=DAY_START_HOUR, minute=0)

                while slot_start.hour < DAY_END_HOUR:
                    slot_end = slot_start + timedelta(minutes=service.duration_minutes)
                    db.add(
                        TimeSlot(
                            service_id=service.id,
                            start_time=slot_start,
                            end_time=slot_end,
                        )
                    )
                    slot_count += 1
                    slot_start += timedelta(minutes=SLOT_INTERVAL)

        await db.commit()
        print(f"Created {slot_count} time slots")
        print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed())
