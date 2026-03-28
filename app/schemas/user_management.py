from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.admin_user import AdminRole


def validate_password_strength(password: str) -> str:
    errors: list[str] = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not any(char.islower() for char in password):
        errors.append("one lowercase letter")
    if not any(char.isupper() for char in password):
        errors.append("one uppercase letter")
    if not any(char.isdigit() for char in password):
        errors.append("one digit")
    if not any(not char.isalnum() for char in password):
        errors.append("one special character")
    if errors:
        raise ValueError("Password must contain " + ", ".join(errors))
    return password


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


class AdminPasswordResetRequest(BaseModel):
    user_id: uuid.UUID
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


class PasswordResetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    detail: str


class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    employee_code: str | None = None
    template_id: uuid.UUID | None = None
    is_active: bool = True
    must_change_password: bool = True

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserUpdateRequest(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    employee_code: str | None = None


class UserTemplateAssignmentRequest(BaseModel):
    template_id: uuid.UUID


class UserForcePasswordResetRequest(BaseModel):
    must_change_password: bool = True


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    role: AdminRole
    template_id: uuid.UUID | None = None
    template_name: str | None = None
    phone: str | None = None
    employee_code: str | None = None
    is_active: bool
    is_first_login: bool
    must_change_password: bool
    failed_login_attempts: int
    locked_until: datetime | None = None
    last_login_at: datetime | None = None
    created_at: datetime


class UserAuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    performed_by_id: uuid.UUID | None = None
    performed_by_name: str | None = None
    details_json: dict | list | None = Field(default=None)
    created_at: datetime


class PaginatedUserResponse(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    page_size: int
