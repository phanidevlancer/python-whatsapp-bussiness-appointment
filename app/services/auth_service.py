import logging
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, create_access_token
from app.models.admin_user import AdminUser, AdminRole
from app.repositories import admin_user_repository as admin_repo

logger = logging.getLogger(__name__)


async def authenticate(db: AsyncSession, email: str, password: str) -> AdminUser | None:
    user = await admin_repo.get_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


async def login(db: AsyncSession, email: str, password: str) -> tuple[str, AdminUser]:
    user = await authenticate(db, email, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=str(user.id), role=user.role.value)
    logger.info("Admin user %s logged in (role=%s)", user.email, user.role)
    return token, user


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
    logger.info("Created admin user %s (role=%s)", email, role)
    return user
