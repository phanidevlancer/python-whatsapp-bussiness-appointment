import uuid
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.admin_user import AdminRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_redis(request: Request):
    return request.app.state.redis


def get_whatsapp_client(request: Request):
    return request.app.state.whatsapp_client


async def get_current_admin_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
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
    except JWTError:
        raise credentials_exception

    user = await get_by_id(db, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def require_admin(current_user=Depends(get_current_admin_user)):
    if current_user.role != AdminRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return current_user


async def require_manager_or_above(current_user=Depends(get_current_admin_user)):
    if current_user.role not in (AdminRole.ADMIN, AdminRole.MANAGER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager role or above required")
    return current_user
