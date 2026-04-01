import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.models.appointment import AppointmentStatus, AppointmentSource
from app.schemas.customer import CustomerRead
from app.schemas.slot_crm import SlotRead
from app.schemas.service import ServiceRead


class ProviderSlim(BaseModel):
    """Slim provider shape used inside appointment responses — no lazy-loaded relationships."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    role: str
    email: str | None = None
    phone: str | None = None
    is_active: bool


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
    campaign_id: uuid.UUID | None
    campaign_code_snapshot: str | None
    campaign_name_snapshot: str | None
    discount_type_snapshot: str | None
    discount_value_snapshot: Decimal | None
    service_cost_snapshot: Decimal | None
    final_cost_snapshot: Decimal | None
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
    provider: ProviderSlim | None = None
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
    changed_by_name: str | None = None
    changed_by_email: str | None = None
    reason: str | None
    source: AppointmentSource | None
    reschedule_source: AppointmentSource | None
    slot_start_time: datetime | None
    old_slot_start_time: datetime | None
    created_at: datetime

    @classmethod
    def from_orm_with_user(cls, record) -> "AppointmentStatusHistoryRead":
        obj = cls.model_validate(record)
        if getattr(record, "changed_by", None):
            obj.changed_by_name = record.changed_by.name
            obj.changed_by_email = record.changed_by.email
        return obj


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
