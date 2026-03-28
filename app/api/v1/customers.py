import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user
from app.db.session import get_db
from app.repositories import customer_repository as customer_repo
from app.repositories import entity_change_history_repository as history_repo
from app.schemas.appointment_crm import AppointmentCRMRead, PaginatedAppointmentResponse
from app.schemas.customer import CustomerCreate, CustomerListResponse, CustomerRead, CustomerUpdate
from app.schemas.entity_change_history import EntityChangeHistoryRead

router = APIRouter()


@router.get("/", response_model=CustomerListResponse)
async def list_customers(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    items, total = await customer_repo.list_customers(db, search=search, page=page, page_size=page_size)
    return CustomerListResponse(
        items=[CustomerRead.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    customer = await customer_repo.create_customer(
        db,
        phone=payload.phone,
        name=payload.name,
        email=str(payload.email) if payload.email else None,
        notes=payload.notes,
    )
    return CustomerRead.model_validate(customer)


@router.get("/{customer_id}", response_model=CustomerRead)
async def get_customer(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    from fastapi import HTTPException
    customer = await customer_repo.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerRead.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    from fastapi import HTTPException
    updates = payload.model_dump(exclude_none=True)
    if "email" in updates and updates["email"]:
        updates["email"] = str(updates["email"])

    # Fetch current values for history
    existing = await customer_repo.get_by_id(db, customer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")

    changes = {}
    for field, new_val in updates.items():
        old_val = getattr(existing, field, None)
        if str(old_val) != str(new_val):
            changes[field] = (old_val, new_val)

    customer = await customer_repo.update_customer(db, customer_id, **updates)

    if changes:
        await history_repo.record_changes(
            db,
            entity_type="customer",
            entity_id=str(customer_id),
            changes=changes,
            changed_by_id=current_user.id,
        )

    return CustomerRead.model_validate(customer)


@router.get("/{customer_id}/history", response_model=list[EntityChangeHistoryRead])
async def get_customer_history(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    records = await history_repo.get_entity_history(db, "customer", str(customer_id))
    return [EntityChangeHistoryRead.from_orm_with_user(r) for r in records]


@router.get("/{customer_id}/appointments", response_model=PaginatedAppointmentResponse)
async def get_customer_appointments(
    customer_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    items, total = await customer_repo.get_customer_appointments(
        db, customer_id, page=page, page_size=page_size
    )
    return PaginatedAppointmentResponse(
        items=[AppointmentCRMRead.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )
