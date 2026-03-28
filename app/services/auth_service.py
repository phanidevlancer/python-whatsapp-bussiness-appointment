from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.admin_user import AdminRole, AdminUser
from app.repositories import admin_user_repository as admin_repo

logger = logging.getLogger(__name__)

FAILED_LOGIN_THRESHOLD = 5
LOCKOUT_DURATION = timedelta(minutes=15)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_lock_active(user: AdminUser) -> bool:
    return bool(user.locked_until and user.locked_until > _utcnow())


async def _clear_expired_lock(db: AsyncSession, user: AdminUser) -> None:
    if user.locked_until and user.locked_until <= _utcnow():
        user.locked_until = None
        user.failed_login_attempts = 0
        await db.flush()


async def _record_failed_login(db: AsyncSession, user: AdminUser) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= FAILED_LOGIN_THRESHOLD:
        user.locked_until = _utcnow() + LOCKOUT_DURATION
    await db.flush()


async def _reset_login_counters(db: AsyncSession, user: AdminUser) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = _utcnow()
    await db.flush()


async def authenticate(db: AsyncSession, email: str, password: str) -> AdminUser | None:
    user = await admin_repo.get_by_email(db, email)
    if not user or not user.is_active:
        return None

    await _clear_expired_lock(db, user)
    if _is_lock_active(user):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is temporarily locked. Try again later.",
        )

    if not verify_password(password, user.hashed_password):
        await _record_failed_login(db, user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await _reset_login_counters(db, user)
    return user


async def login(db: AsyncSession, email: str, password: str) -> AdminUser:
    user = await authenticate(db, email, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.info("Admin user %s logged in (role=%s)", user.email, user.role)
    return user


async def change_password(
    db: AsyncSession,
    user: AdminUser,
    current_password: str,
    new_password: str,
) -> AdminUser:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.hashed_password = hash_password(new_password)
    user.is_first_login = False
    user.must_change_password = False
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.flush()
    return user


async def admin_reset_password(
    db: AsyncSession,
    user_id: uuid.UUID,
    new_password: str,
    performed_by: AdminUser,
) -> AdminUser:
    if performed_by.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use self-service password change for your own account",
        )

    user = await admin_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = hash_password(new_password)
    user.is_first_login = False
    user.must_change_password = True
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.flush()
    logger.info("Admin user %s reset password for %s", performed_by.email, user.email)
    return user


async def register_admin(
    db: AsyncSession,
    email: str,
    password: str,
    name: str,
    role: AdminRole,
) -> AdminUser:
    existing = await admin_repo.get_by_email(db, email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email {email} already registered",
        )
    user = await admin_repo.create_admin_user(db, email, password, name, role)
    user.is_first_login = True
    user.must_change_password = True
    await db.flush()
    logger.info("Created admin user %s (role=%s)", email, role)
    return user
