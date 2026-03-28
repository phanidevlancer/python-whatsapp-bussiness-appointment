import uuid
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entity_change_history import EntityChangeHistory

MAX_HISTORY_PER_FIELD = 10


async def record_changes(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    changes: dict,  # {field_name: (old_value, new_value)}
    changed_by_id: uuid.UUID | None,
) -> None:
    """Record field-level changes and prune to MAX_HISTORY_PER_FIELD per (entity, field)."""
    for field_name, (old_value, new_value) in changes.items():
        # Insert new record
        record = EntityChangeHistory(
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            changed_by_id=changed_by_id,
        )
        db.add(record)
        await db.flush()

        # Count how many exist for this entity+field
        count_q = await db.execute(
            select(func.count())
            .where(
                EntityChangeHistory.entity_type == entity_type,
                EntityChangeHistory.entity_id == entity_id,
                EntityChangeHistory.field_name == field_name,
            )
        )
        count = count_q.scalar_one()

        if count > MAX_HISTORY_PER_FIELD:
            # Delete oldest beyond the limit
            oldest_q = await db.execute(
                select(EntityChangeHistory.id)
                .where(
                    EntityChangeHistory.entity_type == entity_type,
                    EntityChangeHistory.entity_id == entity_id,
                    EntityChangeHistory.field_name == field_name,
                )
                .order_by(EntityChangeHistory.created_at.asc())
                .limit(count - MAX_HISTORY_PER_FIELD)
            )
            oldest_ids = [row[0] for row in oldest_q.fetchall()]
            if oldest_ids:
                await db.execute(
                    delete(EntityChangeHistory).where(EntityChangeHistory.id.in_(oldest_ids))
                )


async def get_entity_history(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    limit: int = 10,
) -> list[EntityChangeHistory]:
    result = await db.execute(
        select(EntityChangeHistory)
        .options(selectinload(EntityChangeHistory.changed_by))
        .where(
            EntityChangeHistory.entity_type == entity_type,
            EntityChangeHistory.entity_id == entity_id,
        )
        .order_by(EntityChangeHistory.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
