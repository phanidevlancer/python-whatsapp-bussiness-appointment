import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.appointment import AppointmentStatus


class AppointmentRead(BaseModel):
    id: uuid.UUID
    user_phone: str
    service_id: uuid.UUID
    slot_id: uuid.UUID
    status: AppointmentStatus
    booked_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
