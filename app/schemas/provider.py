import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class ProviderCreate(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None


class ProviderUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    is_active: bool | None = None


class ProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
