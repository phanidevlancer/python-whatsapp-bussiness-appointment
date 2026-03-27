import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.admin_user import AdminUser, AdminRole
from app.core.security import hash_password


async def get_by_email(db: AsyncSession, email: str) -> AdminUser | None:
    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> AdminUser | None:
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    return result.scalar_one_or_none()


async def create_admin_user(
    db: AsyncSession,
    email: str,
    password: str,
    name: str,
    role: AdminRole,
) -> AdminUser:
    user = AdminUser(
        email=email,
        hashed_password=hash_password(password),
        name=name,
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


async def list_admin_users(db: AsyncSession) -> list[AdminUser]:
    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at))
    return list(result.scalars().all())
