from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user
from app.db.session import get_db
from app.schemas.admin_user import AdminUserRead, TokenResponse
from app.services import auth_service

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    token, user = await auth_service.login(db, form_data.username, form_data.password)
    return TokenResponse(access_token=token, user=AdminUserRead.model_validate(user))


@router.get("/me", response_model=AdminUserRead)
async def me(current_user=Depends(get_current_admin_user)):
    return AdminUserRead.model_validate(current_user)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout():
    # JWT is stateless — client discards the token
    return {"detail": "Logged out"}
