import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, require_permission
from app.db.session import get_db
from app.schemas.role_template import (
    RoleTemplateCopyRequest,
    RoleTemplateCreate,
    RoleTemplateListItem,
    RoleTemplatePermissionsUpdate,
    RoleTemplateRead,
    RoleTemplateUpdate,
    RoleTemplateUsageRead,
)
from app.services import role_template_service as template_svc

router = APIRouter()


def _to_read(template) -> RoleTemplateRead:
    return RoleTemplateRead.model_validate(template)


@router.get("/", response_model=list[RoleTemplateListItem])
async def list_role_templates(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.view")),
):
    templates = await template_svc.list_templates(db)
    result: list[RoleTemplateListItem] = []
    for template in templates:
        usage = await template_svc.get_usage(db, template.id)
        result.append(
            RoleTemplateListItem(
                **_to_read(template).model_dump(),
                assigned_user_count=usage["user_count"],
            )
        )
    return result


@router.post("/", response_model=RoleTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_role_template(
    payload: RoleTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("roles.create")),
):
    template = await template_svc.create_template(db, payload, current_user)
    return _to_read(template)


@router.get("/{template_id}", response_model=RoleTemplateRead)
async def get_role_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.view")),
):
    template = await template_svc.get_template(db, template_id)
    return _to_read(template)


@router.patch("/{template_id}", response_model=RoleTemplateRead)
async def update_role_template(
    template_id: uuid.UUID,
    payload: RoleTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("roles.update")),
):
    template = await template_svc.update_template(db, template_id, payload, current_user)
    return _to_read(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.delete")),
):
    await template_svc.delete_template(db, template_id)
    return None


@router.post("/{template_id}/copy", response_model=RoleTemplateRead, status_code=status.HTTP_201_CREATED)
async def copy_role_template(
    template_id: uuid.UUID,
    payload: RoleTemplateCopyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("roles.create")),
):
    template = await template_svc.copy_template(db, template_id, payload.name, current_user)
    return _to_read(template)


@router.patch("/{template_id}/permissions", response_model=RoleTemplateRead)
async def replace_role_template_permissions(
    template_id: uuid.UUID,
    payload: RoleTemplatePermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("roles.manage")),
):
    template = await template_svc.replace_permissions(db, template_id, payload, current_user)
    return _to_read(template)


@router.get("/{template_id}/usage", response_model=RoleTemplateUsageRead)
async def get_role_template_usage(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.view")),
):
    usage = await template_svc.get_usage(db, template_id)
    return RoleTemplateUsageRead.model_validate(usage)

