import logging

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class SessionService:
    """
    Redis-backed service for:
    1. Idempotency — deduplication of repeated webhook deliveries
    2. Slot locking — soft reservation during the confirmation step

    Redis key patterns:
      whatsapp:idempotency:{message_id}   TTL = IDEMPOTENCY_TTL_SECONDS (24h)
      whatsapp:slot_lock:{slot_id}        TTL = SLOT_LOCK_TTL_SECONDS (5 min)
    """

    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    # -------------------------------------------------------------------------
    # Idempotency
    # -------------------------------------------------------------------------

    async def is_duplicate_message(self, message_id: str) -> bool:
        """Return True if this message_id was already processed."""
        key = f"whatsapp:idempotency:{message_id}"
        return bool(await self._redis.exists(key))

    async def mark_message_processed(self, message_id: str) -> None:
        """Mark a message_id as processed. Expires after IDEMPOTENCY_TTL_SECONDS."""
        key = f"whatsapp:idempotency:{message_id}"
        await self._redis.set(key, "1", ex=settings.IDEMPOTENCY_TTL_SECONDS)

    # -------------------------------------------------------------------------
    # Slot locking
    # -------------------------------------------------------------------------

    async def acquire_slot_lock(self, slot_id: str, user_phone: str) -> bool:
        """
        Attempt to acquire a soft reservation lock on a slot.

        Uses Redis SET NX EX (atomic set-if-not-exists with expiry).
        - Returns True if the lock was acquired (slot is free to reserve).
        - Returns False if another user already holds the lock.

        The TTL ensures the lock auto-releases if the app crashes or the user
        abandons the flow without cancelling.
        """
        key = f"whatsapp:slot_lock:{slot_id}"
        result = await self._redis.set(
            key,
            user_phone,           # Value = owner phone for debugging
            nx=True,              # Only set if key does not exist
            ex=settings.SLOT_LOCK_TTL_SECONDS,
        )
        acquired = result is not None  # SET NX returns None when key already exists
        if not acquired:
            logger.info("Slot %s is already locked by another user", slot_id)
        return acquired

    async def release_slot_lock(self, slot_id: str) -> None:
        """Release the slot lock after booking is confirmed or cancelled."""
        key = f"whatsapp:slot_lock:{slot_id}"
        await self._redis.delete(key)

    async def is_slot_locked(self, slot_id: str) -> bool:
        """Check if a slot currently has an active soft lock."""
        key = f"whatsapp:slot_lock:{slot_id}"
        return bool(await self._redis.exists(key))
