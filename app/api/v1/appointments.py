import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_redis, require_manager_or_above
from app.db.session import get_db
from app.models.appointment import AppointmentStatus
from app.repositories import appointment_repository as appt_repo
from app.schemas.appointment_crm import (
    AppointmentCancelRequest,
    AppointmentCRMCreate,
    AppointmentCRMRead,
    AppointmentCRMUpdate,
    AppointmentRescheduleRequest,
    AppointmentStatusHistoryRead,
    PaginatedAppointmentResponse,
)
from app.services import appointment_crm_service as crm_svc
from app.services.session_service import SessionService

router = APIRouter()


def _get_session_svc(redis=Depends(get_redis)) -> SessionService:
    return SessionService(redis)


@router.post("/", response_model=AppointmentCRMRead, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCRMCreate,
    db: AsyncSession = Depends(get_db),
    session_svc: SessionService = Depends(_get_session_svc),
    current_user=Depends(get_current_admin_user),
):
    appt = await crm_svc.create_appointment(db, session_svc, payload, current_user)
    # Reload with relationships to avoid lazy loading
    appt = await appt_repo.get_appointment_crm_by_id(db, appt.id)
    return AppointmentCRMRead.model_validate(appt)


@router.get("/", response_model=PaginatedAppointmentResponse)
async def list_appointments(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[AppointmentStatus] = Query(None),
    service_id: Optional[uuid.UUID] = Query(None),
    provider_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    items, total = await appt_repo.list_appointments_crm(
        db,
        date_from=date_from,
        date_to=date_to,
        status=status,
        service_id=service_id,
        provider_id=provider_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    return PaginatedAppointmentResponse(
        items=[AppointmentCRMRead.model_validate(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{appointment_id}", response_model=AppointmentCRMRead)
async def get_appointment(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    appt = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
    if not appt:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentCRMRead.model_validate(appt)


@router.get("/{appointment_id}/history", response_model=list[AppointmentStatusHistoryRead])
async def get_appointment_history(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    history = await appt_repo.get_appointment_history(db, appointment_id)
    return [AppointmentStatusHistoryRead.model_validate(h) for h in history]


@router.patch("/{appointment_id}", response_model=AppointmentCRMRead)
async def update_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentCRMUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    appt = await crm_svc.update_appointment(db, appointment_id, payload, current_user)
    return AppointmentCRMRead.model_validate(appt)


@router.post("/{appointment_id}/reschedule", response_model=AppointmentCRMRead)
async def reschedule_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentRescheduleRequest,
    db: AsyncSession = Depends(get_db),
    session_svc: SessionService = Depends(_get_session_svc),
    current_user=Depends(get_current_admin_user),
):
    appt = await crm_svc.reschedule_appointment(
        db, session_svc, appointment_id, payload.new_slot_id, payload.reason, current_user
    )
    return AppointmentCRMRead.model_validate(appt)


@router.post("/{appointment_id}/cancel", response_model=AppointmentCRMRead)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentCancelRequest,
    db: AsyncSession = Depends(get_db),
    session_svc: SessionService = Depends(_get_session_svc),
    current_user=Depends(get_current_admin_user),
):
    appt = await crm_svc.cancel_appointment(
        db, session_svc, appointment_id, payload.reason, current_user, payload.cancellation_source
    )
    return AppointmentCRMRead.model_validate(appt)


@router.post("/{appointment_id}/complete", response_model=AppointmentCRMRead)
async def complete_appointment(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    appt = await crm_svc.mark_completed(db, appointment_id, current_user)
    return AppointmentCRMRead.model_validate(appt)


@router.post("/{appointment_id}/no-show", response_model=AppointmentCRMRead)
async def no_show_appointment(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    appt = await crm_svc.mark_no_show(db, appointment_id, current_user)
    return AppointmentCRMRead.model_validate(appt)
