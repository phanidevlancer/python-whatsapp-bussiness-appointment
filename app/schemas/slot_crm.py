import uuid
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict


class SlotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    service_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    is_booked: bool
    booked_at: datetime | None


class SlotGenerateRequest(BaseModel):
    service_id: uuid.UUID
    date_from: date
    date_to: date
    start_hour: int = 9
    end_hour: int = 17
    interval_minutes: int = 30


class SlotListResponse(BaseModel):
    items: list[SlotRead]
    total: int
