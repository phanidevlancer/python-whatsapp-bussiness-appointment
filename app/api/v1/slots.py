import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.models.time_slot import TimeSlot
from app.schemas.slot_crm import SlotGenerateRequest, SlotListResponse, SlotRead

router = APIRouter()


@router.get("/", response_model=SlotListResponse)
async def list_slots(
    service_id: Optional[uuid.UUID] = Query(None),
    filter_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    available_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("slots.view")),
):
    from sqlalchemy import func
    now = datetime.now(timezone.utc)
    query = select(TimeSlot).where(TimeSlot.start_time >= now)
    if service_id:
        query = query.where(TimeSlot.service_id == service_id)
    if available_only:
        query = query.where(TimeSlot.is_booked == False)
    if filter_date:
        try:
            from datetime import date
            d = date.fromisoformat(filter_date)
            day_start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
            day_end = day_start + timedelta(days=1)
            query = query.where(TimeSlot.start_time >= day_start, TimeSlot.start_time < day_end)
        except ValueError:
            pass

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    query = query.order_by(TimeSlot.start_time).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    slots = list(result.scalars().all())
    return SlotListResponse(items=[SlotRead.model_validate(s) for s in slots], total=total)


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_slots(
    payload: SlotGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("slots.create")),
):
    """Bulk generate time slots for a service across a date range."""
    from app.repositories import service_repository as svc_repo
    from fastapi import HTTPException

    service = await svc_repo.get_service_by_id(db, payload.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    created = 0
    skipped = 0
    current_date = payload.date_from
    interval = timedelta(minutes=payload.interval_minutes)

    while current_date <= payload.date_to:
        slot_time = datetime(
            current_date.year, current_date.month, current_date.day,
            payload.start_hour, 0, 0, tzinfo=timezone.utc
        )
        end_boundary = slot_time.replace(hour=payload.end_hour, minute=0, second=0)

        while slot_time < end_boundary:
            slot_end = slot_time + timedelta(minutes=service.duration_minutes)
            # Check if slot already exists
            existing = await db.execute(
                select(TimeSlot).where(
                    TimeSlot.service_id == payload.service_id,
                    TimeSlot.start_time == slot_time,
                )
            )
            if existing.scalar_one_or_none() is None:
                db.add(TimeSlot(
                    service_id=payload.service_id,
                    start_time=slot_time,
                    end_time=slot_end,
                ))
                created += 1
            else:
                skipped += 1
            slot_time += interval

        from datetime import date as date_cls, timedelta as td
        current_date = date_cls(current_date.year, current_date.month, current_date.day) + td(days=1)

    await db.flush()
    return {"created": created, "skipped": skipped}


@router.post("/{slot_id}/block", response_model=SlotRead)
async def block_slot(
    slot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("slots.update")),
):
    from fastapi import HTTPException
    slot = await db.get(TimeSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_booked = True
    await db.flush()
    return SlotRead.model_validate(slot)


@router.post("/{slot_id}/unblock", response_model=SlotRead)
async def unblock_slot(
    slot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("slots.update")),
):
    from fastapi import HTTPException
    from app.models.appointment import Appointment, AppointmentStatus
    # Safety check: don't unblock if there's a confirmed appointment
    existing = await db.execute(
        select(Appointment).where(
            Appointment.slot_id == slot_id,
            Appointment.status == AppointmentStatus.CONFIRMED,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot unblock a slot that has a confirmed appointment",
        )
    slot = await db.get(TimeSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_booked = False
    slot.booked_at = None
    await db.flush()
    return SlotRead.model_validate(slot)
