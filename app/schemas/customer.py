import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class CustomerCreate(BaseModel):
    phone: str
    name: str | None = None
    email: EmailStr | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    notes: str | None = None


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    name: str | None
    email: str | None
    notes: str | None
    created_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerRead]
    total: int
    page: int
    page_size: int
