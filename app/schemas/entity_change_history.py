import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EntityChangeHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_id: str
    field_name: str
    old_value: str | None
    new_value: str | None
    changed_by_id: uuid.UUID | None
    changed_by_name: str | None = None
    changed_by_email: str | None = None
    created_at: datetime

    @classmethod
    def from_orm_with_user(cls, record) -> "EntityChangeHistoryRead":
        obj = cls.model_validate(record)
        if record.changed_by:
            obj.changed_by_name = record.changed_by.name
            obj.changed_by_email = record.changed_by.email
        return obj
