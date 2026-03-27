import uuid
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict
from app.models.appointment import AppointmentStatus, AppointmentSource
from app.schemas.customer import CustomerRead
from app.schemas.provider import ProviderRead
from app.schemas.slot_crm import SlotRead
from app.schemas.service import ServiceRead


class AppointmentCRMCreate(BaseModel):
    user_phone: str
    service_id: uuid.UUID
    slot_id: uuid.UUID
    provider_id: uuid.UUID | None = None
    notes: str | None = None
    source: AppointmentSource = AppointmentSource.ADMIN_DASHBOARD


class AppointmentCRMUpdate(BaseModel):
    provider_id: uuid.UUID | None = None
    notes: str | None = None
    status: AppointmentStatus | None = None


class AppointmentCRMRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_phone: str
    service_id: uuid.UUID
    slot_id: uuid.UUID
    status: AppointmentStatus
    provider_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    notes: str | None
    cancellation_reason: str | None
    cancellation_source: AppointmentSource | None
    rescheduled_from_slot_id: uuid.UUID | None
    reschedule_source: AppointmentSource | None
    source: AppointmentSource
    booked_at: datetime
    created_at: datetime
    service: ServiceRead | None = None
    slot: SlotRead | None = None
    provider: ProviderRead | None = None
    customer: CustomerRead | None = None


class AppointmentRescheduleRequest(BaseModel):
    new_slot_id: uuid.UUID
    reason: str | None = None
    reschedule_source: AppointmentSource | None = None


class AppointmentCancelRequest(BaseModel):
    reason: str | None = None
    cancellation_source: AppointmentSource | None = None


class AppointmentStatusHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    appointment_id: uuid.UUID
    old_status: str | None
    new_status: str
    changed_by_id: uuid.UUID | None
    reason: str | None
    source: AppointmentSource | None
    reschedule_source: AppointmentSource | None
    slot_start_time: datetime | None
    old_slot_start_time: datetime | None
    created_at: datetime


class PaginatedAppointmentResponse(BaseModel):
    items: list[AppointmentCRMRead]
    total: int
    page: int
    page_size: int


class AppointmentFilters(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    status: AppointmentStatus | None = None
    service_id: uuid.UUID | None = None
    provider_id: uuid.UUID | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 20
