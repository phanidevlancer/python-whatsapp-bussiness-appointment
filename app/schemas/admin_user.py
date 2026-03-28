import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from app.models.admin_user import AdminRole
from app.schemas.user_management import validate_password_strength


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: AdminRole = AdminRole.RECEPTIONIST

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    role: AdminRole
    template_id: uuid.UUID | None = None
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AdminUserRead
    permissions: list[str] = Field(default_factory=list)
    must_change_password: bool = False


class CurrentUserResponse(BaseModel):
    user: AdminUserRead
    permissions: list[str] = Field(default_factory=list)
    must_change_password: bool = False
