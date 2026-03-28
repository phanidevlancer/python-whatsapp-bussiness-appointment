import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.repositories import provider_repository as provider_repo
from app.repositories import entity_change_history_repository as history_repo
from app.schemas.provider import ProviderCreate, ProviderRead, ProviderUpdate
from app.schemas.slot_crm import SlotListResponse, SlotRead
from app.schemas.entity_change_history import EntityChangeHistoryRead

router = APIRouter()


@router.get("/", response_model=list[ProviderRead])
async def list_providers(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("providers.view")),
):
    providers = await provider_repo.list_providers(db, active_only=active_only)
    result = []
    for p in providers:
        data = ProviderRead.model_validate(p)
        result.append(data)
    return result


@router.post("/", response_model=ProviderRead, status_code=status.HTTP_201_CREATED)
async def create_provider(
    payload: ProviderCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("providers.create")),
):
    provider = await provider_repo.create_provider(
        db,
        name=payload.name,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
    )
    return ProviderRead.model_validate(provider)


@router.patch("/{provider_id}", response_model=ProviderRead)
async def update_provider(
    provider_id: uuid.UUID,
    payload: ProviderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("providers.update")),
):
    from fastapi import HTTPException
    updates = payload.model_dump(exclude_none=True)
    if "email" in updates and updates["email"]:
        updates["email"] = str(updates["email"])

    # Fetch current for history
    existing = await provider_repo.get_by_id(db, provider_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Provider not found")

    changes = {}
    for field, new_val in updates.items():
        old_val = getattr(existing, field, None)
        if str(old_val) != str(new_val):
            changes[field] = (old_val, new_val)

    provider = await provider_repo.update_provider(db, provider_id, **updates)

    if changes:
        await history_repo.record_changes(
            db,
            entity_type="provider",
            entity_id=str(provider_id),
            changes=changes,
            changed_by_id=current_user.id,
        )

    return ProviderRead.model_validate(provider)


@router.get("/{provider_id}/history", response_model=list[EntityChangeHistoryRead])
async def get_provider_history(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("providers.view")),
):
    records = await history_repo.get_entity_history(db, "provider", str(provider_id))
    return [EntityChangeHistoryRead.from_orm_with_user(r) for r in records]


@router.get("/{provider_id}/slots", response_model=SlotListResponse)
async def get_provider_slots(
    provider_id: uuid.UUID,
    filter_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("providers.view")),
):
    slots = await provider_repo.get_provider_slots(db, provider_id, filter_date=filter_date)
    return SlotListResponse(
        items=[SlotRead.model_validate(s) for s in slots],
        total=len(slots),
    )


@router.post("/{provider_id}/services", response_model=ProviderRead)
async def assign_service_to_provider(
    provider_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("providers.manage")),
):
    from fastapi import HTTPException
    service_id = body.get("service_id")
    if not service_id:
        raise HTTPException(status_code=422, detail="service_id required")
    await provider_repo.assign_service(db, provider_id, uuid.UUID(str(service_id)))
    provider = await provider_repo.get_by_id(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return ProviderRead.model_validate(provider)


@router.delete("/{provider_id}/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_service_from_provider(
    provider_id: uuid.UUID,
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("providers.manage")),
):
    await provider_repo.remove_service(db, provider_id, service_id)
