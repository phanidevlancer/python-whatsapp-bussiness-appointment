from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.admin_user import AdminUser
from app.models.permission import Permission
from app.models.role_template import RoleTemplate


async def get_by_name(db: AsyncSession, name: str) -> RoleTemplate | None:
    result = await db.execute(select(RoleTemplate).where(RoleTemplate.name == name))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, template_id: uuid.UUID) -> RoleTemplate | None:
    result = await db.execute(select(RoleTemplate).where(RoleTemplate.id == template_id))
    return result.scalar_one_or_none()


async def list_templates(db: AsyncSession) -> list[RoleTemplate]:
    result = await db.execute(select(RoleTemplate).order_by(RoleTemplate.name))
    return list(result.scalars().all())


async def upsert_template(
    db: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    is_system: bool = False,
    is_active: bool = True,
    copied_from_template_id: uuid.UUID | None = None,
    created_by: uuid.UUID | None = None,
    updated_by: uuid.UUID | None = None,
) -> tuple[RoleTemplate, bool]:
    existing = await get_by_name(db, name)
    if existing:
        existing.description = description
        existing.is_system = is_system
        existing.is_active = is_active
        existing.copied_from_template_id = copied_from_template_id
        if created_by is not None:
            existing.created_by = created_by
        if updated_by is not None:
            existing.updated_by = updated_by
        await db.flush()
        return existing, False

    template = RoleTemplate(
        name=name,
        description=description,
        is_system=is_system,
        is_active=is_active,
        copied_from_template_id=copied_from_template_id,
        created_by=created_by,
        updated_by=updated_by,
    )
    db.add(template)
    await db.flush()
    return template, True


async def set_template_permissions(
    db: AsyncSession,
    template_id: uuid.UUID,
    permissions: Sequence[Permission],
) -> RoleTemplate:
    template = await get_by_id(db, template_id)
    if template is None:
        raise ValueError(f"Role template {template_id} not found")

    unique_permissions: list[Permission] = []
    seen: set[uuid.UUID] = set()
    for permission in permissions:
        if permission.id in seen:
            continue
        seen.add(permission.id)
        unique_permissions.append(permission)

    template.permissions = unique_permissions
    await db.flush()
    return template


async def get_permissions(db: AsyncSession, template_id: uuid.UUID) -> list[Permission]:
    result = await db.execute(
        select(RoleTemplate)
        .options(selectinload(RoleTemplate.permissions))
        .where(RoleTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    return list(template.permissions) if template else []


async def count_users_assigned(db: AsyncSession, template_id: uuid.UUID) -> int:
    result = await db.execute(select(func.count()).select_from(AdminUser).where(AdminUser.template_id == template_id))
    return int(result.scalar_one())


async def list_users_assigned(db: AsyncSession, template_id: uuid.UUID) -> list[AdminUser]:
    result = await db.execute(select(AdminUser).where(AdminUser.template_id == template_id).order_by(AdminUser.created_at))
    return list(result.scalars().all())
