from dataclasses import dataclass
from datetime import datetime
import uuid


@dataclass
class AppointmentCreatedEvent:
    appointment_id: uuid.UUID
    user_phone: str
    service_name: str
    slot_start_time: datetime
    booking_ref: str


@dataclass
class AppointmentCancelledEvent:
    appointment_id: uuid.UUID
    user_phone: str
    service_name: str
    slot_start_time: datetime
    reason: str | None = None


@dataclass
class AppointmentRescheduledEvent:
    appointment_id: uuid.UUID
    user_phone: str
    service_name: str
    old_slot_start_time: datetime
    new_slot_start_time: datetime
    booking_ref: str


@dataclass
class AppointmentStatusChangedEvent:
    appointment_id: uuid.UUID
    user_phone: str
    old_status: str
    new_status: str
    service_name: str
    slot_start_time: datetime
