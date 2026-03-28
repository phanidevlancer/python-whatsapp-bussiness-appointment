from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_user_permissions, invalidate_user_permissions_cache
from app.models.admin_user import AdminRole, AdminUser
from app.models.role_template import RoleTemplate
from app.repositories import admin_user_repository as admin_repo
from app.repositories import role_template_repository as template_repo
from app.schemas.user_management import (
    UserAuditRead,
    UserCreateRequest,
    UserForcePasswordResetRequest,
    UserRead,
    UserTemplateAssignmentRequest,
    UserUpdateRequest,
)


TEMPLATE_ROLE_MAP: dict[str, AdminRole] = {
    "Super Admin": AdminRole.ADMIN,
    "Admin": AdminRole.ADMIN,
    "Operations Manager": AdminRole.MANAGER,
    "Receptionist": AdminRole.RECEPTIONIST,
    "Viewer": AdminRole.RECEPTIONIST,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _legacy_role_for_template(template: RoleTemplate | None) -> AdminRole:
    if template is None:
        return AdminRole.RECEPTIONIST
    return TEMPLATE_ROLE_MAP.get(template.name, AdminRole.RECEPTIONIST)


async def _to_user_read(user: AdminUser) -> UserRead:
    template = getattr(user, "role_template", None)
    setattr(user, "template_name", template.name if template else None)
    return UserRead.model_validate(user)


async def _to_audit_read(entry) -> UserAuditRead:
    performed_by = getattr(entry, "performed_by", None)
    setattr(entry, "performed_by_name", performed_by.name if performed_by else None)
    return UserAuditRead.model_validate(entry)


async def _load_user_or_404(db: AsyncSession, user_id: uuid.UUID) -> AdminUser:
    user = await admin_repo.get_by_id_with_template(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def _load_template_or_404(db: AsyncSession, template_id: uuid.UUID) -> RoleTemplate:
    template = await template_repo.get_by_id(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role template not found")
    return template


async def _actor_permissions(db: AsyncSession, redis: Redis, actor: AdminUser) -> set[str]:
    return await get_user_permissions(db, redis, actor, token_perms_hash=getattr(actor, "_token_payload", {}).get("perms_hash"))


async def _assert_template_assignable(
    db: AsyncSession,
    redis: Redis,
    actor: AdminUser,
    template: RoleTemplate,
) -> None:
    actor_permissions = await _actor_permissions(db, redis, actor)
    template_permissions = await template_repo.get_permissions(db, template.id)
    template_codes = {permission.code for permission in template_permissions}
    if not template_codes.issubset(actor_permissions):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign a template with permissions above your own access level",
        )


async def _audit(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    performed_by: AdminUser | None = None,
    details_json: dict | list | None = None,
) -> None:
    await admin_repo.create_user_audit_log(
        db,
        user_id,
        action,
        performed_by_id=performed_by.id if performed_by else None,
        details_json=details_json,
    )


async def list_users(
    db: AsyncSession,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[UserRead], int]:
    users, total = await admin_repo.list_admin_users(db, search=search, page=page, page_size=page_size)
    return [await _to_user_read(user) for user in users], total


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> UserRead:
    user = await _load_user_or_404(db, user_id)
    return await _to_user_read(user)


async def create_user(
    db: AsyncSession,
    redis: Redis,
    payload: UserCreateRequest,
    created_by: AdminUser,
) -> UserRead:
    if await admin_repo.get_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if payload.employee_code:
        if await admin_repo.get_by_employee_code(db, payload.employee_code):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee code already registered")

    template = None
    if payload.template_id is not None:
        template = await _load_template_or_404(db, payload.template_id)
        await _assert_template_assignable(db, redis, created_by, template)

    user = await admin_repo.create_admin_user(
        db,
        payload.email,
        payload.password,
        payload.name,
        _legacy_role_for_template(template),
        phone=payload.phone,
        employee_code=payload.employee_code,
        template_id=payload.template_id,
        is_active=payload.is_active,
        is_first_login=True,
        must_change_password=payload.must_change_password,
        created_by=created_by.id,
        updated_by=created_by.id,
    )
    await _audit(
        db,
        user.id,
        "created",
        created_by,
        {
            "template_id": str(payload.template_id) if payload.template_id else None,
            "employee_code": payload.employee_code,
        },
    )
    return await _to_user_read(user)


async def update_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    updated_by: AdminUser,
) -> UserRead:
    user = await _load_user_or_404(db, user_id)

    if payload.email and payload.email != user.email:
        existing = await admin_repo.get_by_email(db, payload.email)
        if existing and existing.id != user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    updates = payload.model_dump(exclude_none=True)
    if updates:
        for key, value in updates.items():
            setattr(user, key, value)
        user.updated_by = updated_by.id
        await db.flush()
        await _audit(db, user.id, "updated", updated_by, updates)

    return await _to_user_read(user)


async def deactivate_user(
    db: AsyncSession,
    redis: Redis,
    user_id: uuid.UUID,
    performed_by: AdminUser,
) -> UserRead:
    user = await _load_user_or_404(db, user_id)
    if user.id == performed_by.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot deactivate your own account",
        )
    if not user.is_active:
        return await _to_user_read(user)

    user.is_active = False
    user.updated_by = performed_by.id
    await db.flush()
    await invalidate_user_permissions_cache(redis, user.id)
    await _audit(db, user.id, "deactivated", performed_by)
    return await _to_user_read(user)


async def activate_user(
    db: AsyncSession,
    redis: Redis,
    user_id: uuid.UUID,
    performed_by: AdminUser,
) -> UserRead:
    user = await _load_user_or_404(db, user_id)
    if user.id == performed_by.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot activate your own account",
        )
    if user.is_active:
        return await _to_user_read(user)

    user.is_active = True
    user.updated_by = performed_by.id
    await db.flush()
    await invalidate_user_permissions_cache(redis, user.id)
    await _audit(db, user.id, "activated", performed_by)
    return await _to_user_read(user)


async def assign_template(
    db: AsyncSession,
    redis: Redis,
    user_id: uuid.UUID,
    payload: UserTemplateAssignmentRequest,
    performed_by: AdminUser,
) -> UserRead:
    user = await _load_user_or_404(db, user_id)
    if user.id == performed_by.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role template here",
        )

    template = await _load_template_or_404(db, payload.template_id)
    await _assert_template_assignable(db, redis, performed_by, template)

    user.template_id = template.id
    user.role = _legacy_role_for_template(template)
    user.updated_by = performed_by.id
    await db.flush()
    await invalidate_user_permissions_cache(redis, user.id)
    await _audit(
        db,
        user.id,
        "template_changed",
        performed_by,
        {"template_id": str(template.id), "template_name": template.name},
    )
    return await _to_user_read(user)


async def force_password_reset(
    db: AsyncSession,
    redis: Redis,
    user_id: uuid.UUID,
    payload: UserForcePasswordResetRequest,
    performed_by: AdminUser,
) -> UserRead:
    user = await _load_user_or_404(db, user_id)
    if user.id == performed_by.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use self-service password change for your own account",
        )

    user.must_change_password = payload.must_change_password
    user.is_first_login = False
    user.failed_login_attempts = 0
    user.locked_until = None
    user.updated_by = performed_by.id
    await db.flush()
    await invalidate_user_permissions_cache(redis, user.id)
    await _audit(
        db,
        user.id,
        "password_reset_forced",
        performed_by,
        {"must_change_password": payload.must_change_password},
    )
    return await _to_user_read(user)


async def list_audit_logs(db: AsyncSession, user_id: uuid.UUID) -> list[UserAuditRead]:
    await _load_user_or_404(db, user_id)
    logs = await admin_repo.list_user_audit_logs(db, user_id)
    return [await _to_audit_read(log) for log in logs]
