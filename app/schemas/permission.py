import uuid

from pydantic import BaseModel, ConfigDict


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    module: str
    action: str
    code: str
    description: str | None = None


class PermissionGroupRead(BaseModel):
    module: str
    permissions: list[PermissionRead]

