import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.repositories import customer_repository as customer_repo
from app.repositories import entity_change_history_repository as history_repo
from app.schemas.appointment_crm import AppointmentCRMRead, PaginatedAppointmentResponse
from app.schemas.customer import (
    CustomerContactUpdate,
    CustomerCreate,
    CustomerListResponse,
    CustomerRead,
    CustomerUpdate,
)
from app.schemas.entity_change_history import EntityChangeHistoryRead

router = APIRouter()


@router.get("/", response_model=CustomerListResponse)
async def list_customers(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("customers.view")),
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
    _=Depends(require_permission("customers.create")),
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
    _=Depends(require_permission("customers.view")),
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
    current_user=Depends(require_permission("customers.update")),
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


@router.patch("/{customer_id}/contact", response_model=CustomerRead)
async def update_customer_contact(
    customer_id: uuid.UUID,
    payload: CustomerContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("customers.partial_update_contact")),
):
    from fastapi import HTTPException

    updates = payload.model_dump(exclude_none=True)
    if "email" in updates and updates["email"]:
        updates["email"] = str(updates["email"])

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
    _=Depends(require_permission("customers.view")),
):
    records = await history_repo.get_entity_history(db, "customer", str(customer_id))
    return [EntityChangeHistoryRead.from_orm_with_user(r) for r in records]


@router.get("/{customer_id}/activity")
async def get_customer_activity(
    customer_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("customers.view")),
):
    """
    Unified activity timeline for a customer.
    Merges appointment status changes, profile edits, and WhatsApp messages
    into a single chronological feed.
    """
    from fastapi import HTTPException
    from sqlalchemy import or_, select
    from app.models.appointment import Appointment
    from app.models.appointment_status_history import AppointmentStatusHistory
    from app.models.entity_change_history import EntityChangeHistory
    from app.models.whatsapp_message_log import WhatsAppMessageLog
    from app.models.customer import Customer

    customer = await customer_repo.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    events = []

    # 1. Appointment status history events
    normalized_phone = customer_repo.normalize_phone(customer.phone)
    phone_variants = [normalized_phone, '+' + normalized_phone]

    appt_result = await db.execute(
        select(Appointment.id, Appointment.user_phone)
        .where(
            or_(
                Appointment.customer_id == customer_id,
                Appointment.customer_id.is_(None) & Appointment.user_phone.in_(phone_variants),
            )
        )
    )
    appt_rows = appt_result.all()
    appt_ids = [r.id for r in appt_rows]

    if appt_ids:
        from sqlalchemy.orm import selectinload
        hist_result = await db.execute(
            select(AppointmentStatusHistory)
            .where(AppointmentStatusHistory.appointment_id.in_(appt_ids))
            .order_by(AppointmentStatusHistory.created_at.desc())
            .limit(limit)
        )
        for h in hist_result.scalars().all():
            events.append({
                "type": "appointment_event",
                "event": _status_label(h.old_status, h.new_status),
                "detail": h.reason,
                "source": h.source.value if h.source else None,
                "appointment_id": str(h.appointment_id),
                "created_at": h.created_at.isoformat(),
            })

    # 2. Profile change history
    history_records = await history_repo.get_entity_history(db, "customer", str(customer_id))
    for h in history_records:
        events.append({
            "type": "profile_change",
            "event": f"{h.field_name} updated",
            "detail": f'"{h.old_value or "—"}" → "{h.new_value or "—"}"',
            "source": "admin_dashboard",
            "appointment_id": None,
            "created_at": h.created_at.isoformat(),
        })

    # 3. WhatsApp outbound messages
    msg_result = await db.execute(
        select(WhatsAppMessageLog)
        .where(WhatsAppMessageLog.customer_phone.in_([customer.phone, customer.phone.lstrip('+')]))
        .order_by(WhatsAppMessageLog.created_at.desc())
        .limit(limit)
    )
    for m in msg_result.scalars().all():
        events.append({
            "type": "message_sent",
            "event": m.message_type.replace("_", " ").title(),
            "detail": f"Status: {m.status.value if hasattr(m.status, 'value') else m.status}",
            "source": "whatsapp",
            "appointment_id": str(m.appointment_id) if m.appointment_id else None,
            "created_at": m.created_at.isoformat(),
        })

    # Sort all merged events by time desc
    events.sort(key=lambda x: x["created_at"], reverse=True)
    return events[:limit]


def _status_label(old: str | None, new: str) -> str:
    if old is None:
        return f"Appointment {new}"
    return f"Status changed: {old} → {new}"


@router.get("/{customer_id}/appointments", response_model=PaginatedAppointmentResponse)
async def get_customer_appointments(
    customer_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("customers.view")),
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
