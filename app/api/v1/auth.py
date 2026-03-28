from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_current_user_permissions, get_redis, require_admin
from app.core.permissions import (
    blacklist_token,
)
from app.core.security import create_access_token
from app.db.session import get_db
from app.schemas.admin_user import AdminUserRead, CurrentUserResponse, TokenResponse
from app.schemas.user_management import AdminPasswordResetRequest, PasswordChangeRequest
from app.services import auth_service

router = APIRouter()


def _token_expiration_from_payload(payload: dict) -> datetime | None:
    exp = payload.get("exp")
    if exp is None:
        return None
    if isinstance(exp, datetime):
        return exp
    try:
        return datetime.fromtimestamp(int(exp), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


async def _build_session_response(
    db: AsyncSession,
    redis,
    user,
) -> TokenResponse:
    permissions = await get_current_user_permissions(
        current_user=user,
        db=db,
        redis=redis,
    )
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token,
        user=AdminUserRead.model_validate(user),
        permissions=sorted(permissions),
        must_change_password=bool(user.must_change_password or user.is_first_login),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    user = await auth_service.login(db, form_data.username, form_data.password)
    return await _build_session_response(db, redis, user)


@router.get("/me", response_model=CurrentUserResponse)
async def me(
    current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    permissions = await get_current_user_permissions(current_user=current_user, db=db, redis=redis)
    return CurrentUserResponse(
        user=AdminUserRead.model_validate(current_user),
        permissions=sorted(permissions),
        must_change_password=bool(current_user.must_change_password or current_user.is_first_login),
    )


@router.post("/change-password", response_model=TokenResponse)
async def change_password(
    payload: PasswordChangeRequest,
    current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    token_payload = getattr(current_user, "_token_payload", {})
    updated_user = await auth_service.change_password(
        db,
        current_user,
        payload.current_password,
        payload.new_password,
    )
    if token_payload.get("jti"):
        await blacklist_token(redis, str(token_payload["jti"]), expires_at=_token_expiration_from_payload(token_payload))
    return await _build_session_response(db, redis, updated_user)


@router.post("/admin-reset-password", response_model=AdminUserRead)
async def admin_reset_password(
    payload: AdminPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    updated_user = await auth_service.admin_reset_password(
        db,
        payload.user_id,
        payload.new_password,
        current_user,
    )
    return AdminUserRead.model_validate(updated_user)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user=Depends(get_current_admin_user),
    redis=Depends(get_redis),
):
    token_payload = getattr(current_user, "_token_payload", {})
    if token_payload.get("jti"):
        await blacklist_token(redis, str(token_payload["jti"]), expires_at=_token_expiration_from_payload(token_payload))
    return {"detail": "Logged out"}
