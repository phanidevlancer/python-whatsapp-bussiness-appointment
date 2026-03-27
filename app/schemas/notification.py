import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.whatsapp_message_log import MessageLogStatus


class NotificationLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    appointment_id: uuid.UUID | None
    customer_phone: str
    message_type: str
    status: MessageLogStatus
    sent_at: datetime | None
    error_message: str | None
    created_at: datetime


class NotificationLogListResponse(BaseModel):
    items: list[NotificationLogRead]
    total: int
    page: int
    page_size: int
