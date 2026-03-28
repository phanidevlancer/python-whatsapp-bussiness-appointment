import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.permission import PermissionRead


class RoleTemplateBase(BaseModel):
    name: str
    description: str | None = None


class RoleTemplateCreate(RoleTemplateBase):
    permission_ids: list[uuid.UUID] = Field(default_factory=list)


class RoleTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class RoleTemplatePermissionsUpdate(BaseModel):
    permission_ids: list[uuid.UUID] = Field(default_factory=list)


class RoleTemplateCopyRequest(BaseModel):
    name: str


class RoleTemplateRead(RoleTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_system: bool
    is_active: bool
    copied_from_template_id: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    updated_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    permissions: list[PermissionRead] = Field(default_factory=list)


class RoleTemplateListItem(RoleTemplateRead):
    assigned_user_count: int = 0


class RoleTemplateUsageUserRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class RoleTemplateUsageRead(BaseModel):
    template_id: uuid.UUID
    user_count: int
    users: list[RoleTemplateUsageUserRead]

