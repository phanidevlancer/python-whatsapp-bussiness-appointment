import uuid
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.admin_user import AdminUser, AdminRole
from app.models.user_audit_log import UserAuditLog
from app.core.security import hash_password


async def get_by_email(db: AsyncSession, email: str) -> AdminUser | None:
    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> AdminUser | None:
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    return result.scalar_one_or_none()


async def get_by_employee_code(db: AsyncSession, employee_code: str) -> AdminUser | None:
    result = await db.execute(select(AdminUser).where(AdminUser.employee_code == employee_code))
    return result.scalar_one_or_none()


async def get_by_id_with_template(db: AsyncSession, user_id: uuid.UUID) -> AdminUser | None:
    result = await db.execute(
        select(AdminUser)
        .options(selectinload(AdminUser.role_template))
        .where(AdminUser.id == user_id)
    )
    return result.scalar_one_or_none()


async def create_admin_user(
    db: AsyncSession,
    email: str,
    password: str,
    name: str,
    role: AdminRole,
    *,
    phone: str | None = None,
    employee_code: str | None = None,
    template_id: uuid.UUID | None = None,
    is_active: bool = True,
    is_first_login: bool = True,
    must_change_password: bool = True,
    created_by: uuid.UUID | None = None,
    updated_by: uuid.UUID | None = None,
) -> AdminUser:
    user = AdminUser(
        email=email,
        hashed_password=hash_password(password),
        name=name,
        role=role,
        phone=phone,
        employee_code=employee_code,
        template_id=template_id,
        is_active=is_active,
        is_first_login=is_first_login,
        must_change_password=must_change_password,
        created_by=created_by,
        updated_by=updated_by,
    )
    db.add(user)
    await db.flush()
    return user


async def list_admin_users(
    db: AsyncSession,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AdminUser], int]:
    query = select(AdminUser).options(selectinload(AdminUser.role_template))
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                AdminUser.email.ilike(like),
                AdminUser.name.ilike(like),
                AdminUser.phone.ilike(like),
                AdminUser.employee_code.ilike(like),
            )
        )
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    query = query.order_by(AdminUser.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def list_all_admin_users(db: AsyncSession) -> list[AdminUser]:
    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at))
    return list(result.scalars().all())


async def update_admin_user(db: AsyncSession, user_id: uuid.UUID, **updates) -> AdminUser | None:
    user = await get_by_id(db, user_id)
    if not user:
        return None
    for key, value in updates.items():
        if value is not None:
            setattr(user, key, value)
    await db.flush()
    return user


async def list_user_audit_logs(db: AsyncSession, user_id: uuid.UUID) -> list[UserAuditLog]:
    result = await db.execute(
        select(UserAuditLog)
        .options(selectinload(UserAuditLog.performed_by))
        .where(UserAuditLog.user_id == user_id)
        .order_by(UserAuditLog.created_at.desc())
    )
    return list(result.scalars().all())


async def create_user_audit_log(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    *,
    performed_by_id: uuid.UUID | None = None,
    details_json: dict | list | None = None,
) -> UserAuditLog:
    log = UserAuditLog(
        user_id=user_id,
        action=action,
        performed_by_id=performed_by_id,
        details_json=details_json,
    )
    db.add(log)
    await db.flush()
    return log
