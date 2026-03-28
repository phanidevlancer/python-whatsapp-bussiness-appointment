from __future__ import annotations

from collections.abc import Iterable, Sequence
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission import Permission


async def get_by_code(db: AsyncSession, code: str) -> Permission | None:
    result = await db.execute(select(Permission).where(Permission.code == code))
    return result.scalar_one_or_none()


async def list_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.action))
    return list(result.scalars().all())


async def get_by_ids(db: AsyncSession, permission_ids: Sequence[uuid.UUID]) -> list[Permission]:
    if not permission_ids:
        return []
    result = await db.execute(select(Permission).where(Permission.id.in_(list(permission_ids))))
    return list(result.scalars().all())


async def upsert_permission(
    db: AsyncSession,
    *,
    module: str,
    action: str,
    code: str,
    description: str | None = None,
) -> tuple[Permission, bool]:
    existing = await get_by_code(db, code)
    if existing:
        existing.module = module
        existing.action = action
        existing.description = description
        await db.flush()
        return existing, False

    permission = Permission(
        module=module,
        action=action,
        code=code,
        description=description,
    )
    db.add(permission)
    await db.flush()
    return permission, True


async def ensure_permissions(
    db: AsyncSession,
    permissions: Iterable[dict[str, str | None]],
) -> list[Permission]:
    results: list[Permission] = []
    for permission in permissions:
        created, _ = await upsert_permission(
            db,
            module=str(permission["module"]),
            action=str(permission["action"]),
            code=str(permission["code"]),
            description=permission.get("description"),
        )
        results.append(created)
    return results
