from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Iterable

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.admin_user import AdminRole, AdminUser
from app.models.role_template import RoleTemplate

PERMISSIONS_CACHE_TTL_SECONDS = 4 * 60 * 60

ADMIN_COMPATIBILITY_PERMISSIONS = {
    "services.manage",
    "providers.manage",
    "slots.manage",
    "users.manage",
    "roles.manage",
}

MANAGER_COMPATIBILITY_PERMISSIONS = {
    "appointments.create",
    "appointments.update",
    "appointments.reschedule",
    "appointments.cancel",
    "slots.manage",
    "customers.partial_update_contact",
}

LEGACY_ROLE_PERMISSION_CODES: dict[AdminRole, set[str]] = {
    AdminRole.ADMIN: {
        "dashboard.view",
        "appointments.view",
        "appointments.create",
        "appointments.update",
        "appointments.delete",
        "appointments.reschedule",
        "appointments.cancel",
        "appointments.export",
        "customers.view",
        "customers.create",
        "customers.update",
        "customers.delete",
        "customers.export",
        "customers.partial_update_contact",
        "services.view",
        "services.create",
        "services.update",
        "services.delete",
        "services.manage",
        "providers.view",
        "providers.create",
        "providers.update",
        "providers.delete",
        "providers.manage",
        "slots.view",
        "slots.create",
        "slots.update",
        "slots.delete",
        "slots.manage",
        "leads.view",
        "leads.update",
        "leads.assign",
        "leads.export",
        "notifications.view",
        "notifications.manage",
        "users.view",
        "users.create",
        "users.update",
        "users.manage",
        "roles.view",
        "roles.create",
        "roles.update",
        "roles.manage",
        "reports.view",
        "reports.export",
        "settings.view",
    },
    AdminRole.MANAGER: {
        "dashboard.view",
        "appointments.view",
        "appointments.create",
        "appointments.update",
        "appointments.reschedule",
        "appointments.cancel",
        "appointments.export",
        "customers.view",
        "customers.create",
        "customers.update",
        "customers.export",
        "customers.partial_update_contact",
        "services.view",
        "providers.view",
        "providers.update",
        "slots.view",
        "slots.create",
        "slots.update",
        "slots.manage",
        "leads.view",
        "leads.update",
        "leads.assign",
        "leads.export",
        "notifications.view",
        "notifications.manage",
        "reports.view",
        "reports.export",
    },
    AdminRole.RECEPTIONIST: {
        "dashboard.view",
        "appointments.view",
        "appointments.create",
        "appointments.update",
        "appointments.reschedule",
        "appointments.cancel",
        "customers.view",
        "customers.partial_update_contact",
        "slots.view",
        "notifications.view",
    },
}


def token_blacklist_key(jti: str) -> str:
    return f"auth:token_blacklist:{jti}"


def user_permissions_cache_key(user_id: uuid.UUID | str) -> str:
    return f"auth:user_permissions:{user_id}"


def user_permissions_hash_key(user_id: uuid.UUID | str) -> str:
    return f"auth:user_permissions_hash:{user_id}"


def build_permissions_hash(template_id: uuid.UUID | None, updated_at: datetime | None) -> str:
    raw = f"{template_id}:{updated_at.astimezone(timezone.utc).isoformat() if updated_at else ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _normalize_permissions(values: Iterable[str]) -> list[str]:
    return sorted({value for value in values if value})


def _normalize_role(role: AdminRole | str | None) -> AdminRole | None:
    if role is None:
        return None
    if isinstance(role, AdminRole):
        return role
    for candidate in AdminRole:
        if candidate.value == role:
            return candidate
    return None


async def blacklist_token(redis: Redis, jti: str, expires_at: datetime | None = None) -> None:
    ttl = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    if expires_at is not None:
        delta = int((expires_at - datetime.now(timezone.utc)).total_seconds())
        ttl = max(1, delta)
    await redis.set(token_blacklist_key(jti), "1", ex=ttl)


async def is_token_blacklisted(redis: Redis, jti: str) -> bool:
    return bool(await redis.exists(token_blacklist_key(jti)))


async def get_cached_permissions(redis: Redis, user_id: uuid.UUID | str) -> set[str] | None:
    cached = await redis.get(user_permissions_cache_key(user_id))
    if not cached:
        return None
    try:
        return set(json.loads(cached))
    except json.JSONDecodeError:
        return None


async def get_cached_permissions_hash(redis: Redis, user_id: uuid.UUID | str) -> str | None:
    return await redis.get(user_permissions_hash_key(user_id))


async def cache_permissions(
    redis: Redis,
    user_id: uuid.UUID | str,
    permissions: Iterable[str],
    perms_hash: str,
) -> None:
    normalized = _normalize_permissions(permissions)
    await redis.set(
        user_permissions_cache_key(user_id),
        json.dumps(normalized),
        ex=PERMISSIONS_CACHE_TTL_SECONDS,
    )
    await redis.set(
        user_permissions_hash_key(user_id),
        perms_hash,
        ex=PERMISSIONS_CACHE_TTL_SECONDS,
    )


async def invalidate_user_permissions_cache(redis: Redis, user_id: uuid.UUID | str) -> None:
    await redis.delete(user_permissions_cache_key(user_id))
    await redis.delete(user_permissions_hash_key(user_id))


async def _load_user_with_template(db: AsyncSession, user_id: uuid.UUID) -> AdminUser | None:
    result = await db.execute(
        select(AdminUser)
        .options(selectinload(AdminUser.role_template).selectinload(RoleTemplate.permissions))
        .where(AdminUser.id == user_id)
    )
    return result.scalar_one_or_none()


async def _resolve_permissions_from_template(template: RoleTemplate | None) -> set[str]:
    if template is None:
        return set()
    return {permission.code for permission in template.permissions}


async def get_user_permissions(
    db: AsyncSession,
    redis: Redis,
    user: AdminUser,
    token_perms_hash: str | None = None,
) -> set[str]:
    if user.template_id is None:
        normalized_role = _normalize_role(user.role)
        legacy_permissions = LEGACY_ROLE_PERMISSION_CODES.get(normalized_role, set())
        cache_role = normalized_role.value if normalized_role else str(user.role)
        await cache_permissions(redis, user.id, legacy_permissions, f"legacy:{cache_role}")
        return set(legacy_permissions)

    cached_permissions = await get_cached_permissions(redis, user.id)
    cached_hash = await get_cached_permissions_hash(redis, user.id)

    if cached_permissions is not None and cached_hash is not None:
        if token_perms_hash is None or token_perms_hash == cached_hash:
            return cached_permissions

    loaded_user = await _load_user_with_template(db, user.id)
    template = loaded_user.role_template if loaded_user else None
    if template is None:
        await invalidate_user_permissions_cache(redis, user.id)
        return set()

    permissions = await _resolve_permissions_from_template(template)
    perms_hash = build_permissions_hash(template.id, template.updated_at)
    await cache_permissions(redis, user.id, permissions, perms_hash)
    return permissions
