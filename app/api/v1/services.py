import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, require_admin
from app.db.session import get_db
from app.repositories import service_repository as svc_repo
from app.repositories import entity_change_history_repository as history_repo
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate
from app.schemas.entity_change_history import EntityChangeHistoryRead

router = APIRouter()


@router.get("/", response_model=list[ServiceRead])
async def list_services(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    if include_inactive:
        from sqlalchemy import select
        from app.models.service import Service
        result = await db.execute(select(Service).order_by(Service.name))
        return [ServiceRead.model_validate(s) for s in result.scalars().all()]
    services = await svc_repo.get_active_services(db)
    return [ServiceRead.model_validate(s) for s in services]


@router.post("/", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
async def create_service(
    payload: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    from app.models.service import Service
    service = Service(
        name=payload.name,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
    )
    db.add(service)
    await db.flush()
    return ServiceRead.model_validate(service)


@router.patch("/{service_id}", response_model=ServiceRead)
async def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    from fastapi import HTTPException
    service = await svc_repo.get_service_by_id(db, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    updates = payload.model_dump(exclude_none=True)

    changes = {}
    for field, new_val in updates.items():
        old_val = getattr(service, field, None)
        if str(old_val) != str(new_val):
            changes[field] = (old_val, new_val)

    for key, value in updates.items():
        setattr(service, key, value)
    await db.flush()

    if changes:
        await history_repo.record_changes(
            db,
            entity_type="service",
            entity_id=str(service_id),
            changes=changes,
            changed_by_id=current_user.id,
        )

    return ServiceRead.model_validate(service)


@router.get("/{service_id}/history", response_model=list[EntityChangeHistoryRead])
async def get_service_history(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    records = await history_repo.get_entity_history(db, "service", str(service_id))
    return [EntityChangeHistoryRead.from_orm_with_user(r) for r in records]


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_service(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    from fastapi import HTTPException
    service = await svc_repo.get_service_by_id(db, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if service.is_active:
        await history_repo.record_changes(
            db,
            entity_type="service",
            entity_id=str(service_id),
            changes={"is_active": (True, False)},
            changed_by_id=current_user.id,
        )
    service.is_active = False
    await db.flush()
