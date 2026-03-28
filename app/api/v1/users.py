import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_redis, require_permission
from app.db.session import get_db
from app.schemas.user_management import (
    PaginatedUserResponse,
    UserAuditRead,
    UserCreateRequest,
    UserForcePasswordResetRequest,
    UserRead,
    UserTemplateAssignmentRequest,
    UserUpdateRequest,
)
from app.services import user_management_service as user_svc

router = APIRouter()


@router.get("/", response_model=PaginatedUserResponse)
async def list_users(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("users.view")),
):
    users, total = await user_svc.list_users(db, search=search, page=page, page_size=page_size)
    return PaginatedUserResponse(items=users, total=total, page=page, page_size=page_size)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    current_user=Depends(require_permission("users.create")),
):
    user = await user_svc.create_user(db, redis, payload, current_user)
    return user


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("users.view")),
):
    return await user_svc.get_user(db, user_id)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.update")),
):
    return await user_svc.update_user(db, user_id, payload, current_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    current_user=Depends(require_permission("users.manage")),
):
    await user_svc.deactivate_user(db, redis, user_id, current_user)
    return None


@router.patch("/{user_id}/activate", response_model=UserRead)
async def activate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    current_user=Depends(require_permission("users.manage")),
):
    return await user_svc.activate_user(db, redis, user_id, current_user)


@router.patch("/{user_id}/deactivate", response_model=UserRead)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    current_user=Depends(require_permission("users.manage")),
):
    return await user_svc.deactivate_user(db, redis, user_id, current_user)


@router.patch("/{user_id}/template", response_model=UserRead)
async def assign_template(
    user_id: uuid.UUID,
    payload: UserTemplateAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    current_user=Depends(require_permission("users.manage")),
):
    return await user_svc.assign_template(db, redis, user_id, payload, current_user)


@router.patch("/{user_id}/force-password-reset", response_model=UserRead)
async def force_password_reset(
    user_id: uuid.UUID,
    payload: UserForcePasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    current_user=Depends(require_permission("users.manage")),
):
    return await user_svc.force_password_reset(db, redis, user_id, payload, current_user)


@router.get("/{user_id}/audit-log", response_model=list[UserAuditRead])
async def get_user_audit_log(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("users.view")),
):
    return await user_svc.list_audit_logs(db, user_id)
