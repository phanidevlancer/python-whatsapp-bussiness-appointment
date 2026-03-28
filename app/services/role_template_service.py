from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser
from app.models.permission import Permission
from app.models.role_template import RoleTemplate
from app.repositories import permission_repository as perm_repo
from app.repositories import role_template_repository as template_repo
from app.schemas.role_template import RoleTemplateCreate, RoleTemplatePermissionsUpdate, RoleTemplateUpdate


async def _ensure_template_exists(db: AsyncSession, template_id: uuid.UUID) -> RoleTemplate:
    template = await template_repo.get_by_id(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role template not found")
    return template


def _forbid_system_template_change(template: RoleTemplate) -> None:
    if template.is_system:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="System templates cannot be modified",
        )


async def list_templates(db: AsyncSession) -> list[RoleTemplate]:
    return await template_repo.list_templates(db)


async def get_template(db: AsyncSession, template_id: uuid.UUID) -> RoleTemplate:
    return await _ensure_template_exists(db, template_id)


async def get_template_permissions(db: AsyncSession, template_id: uuid.UUID) -> list[Permission]:
    await _ensure_template_exists(db, template_id)
    return await template_repo.get_permissions(db, template_id)


async def create_template(
    db: AsyncSession,
    payload: RoleTemplateCreate,
    created_by: AdminUser,
) -> RoleTemplate:
    if await template_repo.get_by_name(db, payload.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role template name already exists")

    template = RoleTemplate(
        name=payload.name,
        description=payload.description,
        is_system=False,
        is_active=True,
        created_by=created_by.id,
        updated_by=created_by.id,
    )
    db.add(template)
    await db.flush()

    permissions = await perm_repo.get_by_ids(db, payload.permission_ids)
    await template_repo.set_template_permissions(db, template.id, permissions)
    return template


async def update_template(
    db: AsyncSession,
    template_id: uuid.UUID,
    payload: RoleTemplateUpdate,
    updated_by: AdminUser,
) -> RoleTemplate:
    template = await _ensure_template_exists(db, template_id)
    _forbid_system_template_change(template)

    if payload.name and payload.name != template.name:
        existing = await template_repo.get_by_name(db, payload.name)
        if existing and existing.id != template.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role template name already exists")
        template.name = payload.name
    if payload.description is not None:
        template.description = payload.description
    template.updated_by = updated_by.id
    await db.flush()
    return template


async def delete_template(db: AsyncSession, template_id: uuid.UUID) -> None:
    template = await _ensure_template_exists(db, template_id)
    _forbid_system_template_change(template)

    user_count = await template_repo.count_users_assigned(db, template_id)
    if user_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Template is assigned to {user_count} user(s) and cannot be deleted",
        )
    await db.delete(template)
    await db.flush()


async def copy_template(
    db: AsyncSession,
    template_id: uuid.UUID,
    payload_name: str,
    created_by: AdminUser,
) -> RoleTemplate:
    source = await _ensure_template_exists(db, template_id)
    if await template_repo.get_by_name(db, payload_name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role template name already exists")
    permissions = await template_repo.get_permissions(db, template_id)

    copied = RoleTemplate(
        name=payload_name,
        description=source.description,
        is_system=False,
        is_active=True,
        copied_from_template_id=source.id,
        created_by=created_by.id,
        updated_by=created_by.id,
    )
    db.add(copied)
    await db.flush()
    await template_repo.set_template_permissions(db, copied.id, permissions)
    return copied


async def replace_permissions(
    db: AsyncSession,
    template_id: uuid.UUID,
    payload: RoleTemplatePermissionsUpdate,
    updated_by: AdminUser,
) -> RoleTemplate:
    template = await _ensure_template_exists(db, template_id)
    _forbid_system_template_change(template)
    permissions = await perm_repo.get_by_ids(db, payload.permission_ids)
    template.updated_by = updated_by.id
    return await template_repo.set_template_permissions(db, template.id, permissions)


async def get_usage(db: AsyncSession, template_id: uuid.UUID) -> dict:
    template = await _ensure_template_exists(db, template_id)
    users = await template_repo.list_users_assigned(db, template.id)
    return {
        "template_id": template.id,
        "user_count": len(users),
        "users": users,
    }
