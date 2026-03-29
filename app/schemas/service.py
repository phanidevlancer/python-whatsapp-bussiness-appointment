import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ServiceRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    duration_minutes: int
    cost: Decimal
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ServiceList(BaseModel):
    services: list[ServiceRead]


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    duration_minutes: int
    cost: Decimal


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    cost: Decimal | None = None
    is_active: bool | None = None
