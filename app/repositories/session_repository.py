import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_session import JourneyType, SessionStep, UserSession

# Module-level cache: phone -> UserSession within a single request lifecycle
# We use db's info dict to scope it to the session
_SESSION_CACHE_KEY = "user_session_cache"


async def get_or_create_session(
    db: AsyncSession, user_phone: str
) -> UserSession:
    """
    Get existing session or create a new one.
    Uses db.info cache to avoid duplicate objects within the same transaction.
    """
    # Check request-scoped cache first (avoids duplicate ORM objects)
    cache = db.info.setdefault(_SESSION_CACHE_KEY, {})
    if user_phone in cache:
        return cache[user_phone]

    result = await db.execute(
        select(UserSession).where(UserSession.user_phone == user_phone)
    )
    session = result.scalar_one_or_none()

    if session is None:
        session = UserSession(
            user_phone=user_phone,
            current_step=SessionStep.START,
        )
        db.add(session)

    cache[user_phone] = session
    return session


async def update_session(
    db: AsyncSession,
    user_phone: str,
    step: SessionStep,
    service_id: uuid.UUID | None = None,
    slot_id: uuid.UUID | None = None,
    appointment_id: uuid.UUID | None = None,
) -> UserSession:
    session = await get_or_create_session(db, user_phone)
    session.current_step = step

    if service_id is not None:
        session.selected_service_id = service_id

    if slot_id is not None:
        session.selected_slot_id = slot_id

    if appointment_id is not None:
        session.selected_appointment_id = appointment_id

    return session


async def reset_session(db: AsyncSession, user_phone: str) -> UserSession:
    session = await get_or_create_session(db, user_phone)
    session.current_step = SessionStep.START
    session.selected_service_id = None
    session.selected_slot_id = None
    session.selected_appointment_id = None
    return session


async def mark_journey(
    db: AsyncSession,
    user_phone: str,
    *,
    journey_type: JourneyType | str,
    campaign_id: uuid.UUID | None,
    entry_point: str | None,
    entry_message_id: str | None,
) -> UserSession:
    session = await get_or_create_session(db, user_phone)
    session.active_journey_type = JourneyType(journey_type)
    session.active_campaign_id = campaign_id
    session.journey_entry_point = entry_point
    session.journey_entry_message_id = entry_message_id
    session.journey_started_at = datetime.now(timezone.utc)
    return session
