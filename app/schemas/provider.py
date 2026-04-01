import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class ServiceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class ProviderCreate(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    role: str = "doctor"
    slot_duration_minutes: int = 20
    service_ids: list[uuid.UUID] = []


class ProviderUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    is_active: bool | None = None
    role: str | None = None
    slot_duration_minutes: int | None = None
    service_ids: list[uuid.UUID] | None = None


class ProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    role: str
    email: str | None
    phone: str | None
    is_active: bool
    slot_duration_minutes: int
    created_at: datetime
    services: list[ServiceSummary] = []
