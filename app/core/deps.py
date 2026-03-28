import uuid
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import (
    ADMIN_COMPATIBILITY_PERMISSIONS,
    MANAGER_COMPATIBILITY_PERMISSIONS,
    get_user_permissions,
    is_token_blacklisted,
)
from app.core.security import decode_access_token
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_redis(request: Request):
    return request.app.state.redis


def get_whatsapp_client(request: Request):
    return request.app.state.whatsapp_client


async def get_current_admin_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis),
):
    from app.repositories.admin_user_repository import get_by_id
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_jti = payload.get("jti")
        if token_jti and await is_token_blacklisted(redis, token_jti):
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    except ValueError:
        raise credentials_exception

    user = await get_by_id(db, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    setattr(user, "_token_payload", payload)
    return user


async def get_current_user_permissions(
    current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis),
):
    token_payload = getattr(current_user, "_token_payload", {})
    token_perms_hash = token_payload.get("perms_hash")
    return await get_user_permissions(db, redis, current_user, token_perms_hash=token_perms_hash)


def require_permission(code: str):
    async def _dependency(
        current_user=Depends(get_current_admin_user),
        db: AsyncSession = Depends(get_db),
        redis = Depends(get_redis),
    ):
        permissions = await get_user_permissions(db, redis, current_user, token_perms_hash=getattr(current_user, "_token_payload", {}).get("perms_hash"))
        if code not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{code}' required",
            )
        return current_user

    return _dependency


def _require_all_permissions(*codes: str):
    async def _dependency(
        current_user=Depends(get_current_admin_user),
        db: AsyncSession = Depends(get_db),
        redis = Depends(get_redis),
    ):
        permissions = await get_user_permissions(db, redis, current_user, token_perms_hash=getattr(current_user, "_token_payload", {}).get("perms_hash"))
        if not all(code in permissions for code in codes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _dependency


async def require_admin(
    current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis),
):
    permissions = await get_user_permissions(
        db,
        redis,
        current_user,
        token_perms_hash=getattr(current_user, "_token_payload", {}).get("perms_hash"),
    )
    if not all(code in permissions for code in ADMIN_COMPATIBILITY_PERMISSIONS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


async def require_manager_or_above(
    current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis),
):
    permissions = await get_user_permissions(
        db,
        redis,
        current_user,
        token_perms_hash=getattr(current_user, "_token_payload", {}).get("perms_hash"),
    )
    if not all(code in permissions for code in MANAGER_COMPATIBILITY_PERMISSIONS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager role or above required",
        )
    return current_user
