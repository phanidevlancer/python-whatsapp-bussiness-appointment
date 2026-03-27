"""
Core CRM appointment service — the single source of truth for all appointment mutations.

Rules:
- All slot locking goes through session_svc (Redis) + slot_repo.mark_slot_booked (DB NOWAIT)
- cancel_appointment reuses appt_repo.cancel_appointment() which frees the slot
- WhatsApp messages are dispatched via event_dispatcher (never called directly here)
- Every status change writes an AppointmentStatusHistory entry
"""
import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.events import event_dispatcher
from app.events.appointment_events import (
    AppointmentCancelledEvent,
    AppointmentCreatedEvent,
    AppointmentRescheduledEvent,
    AppointmentStatusChangedEvent,
)
from app.models.appointment import Appointment, AppointmentStatus, AppointmentSource
from app.models.appointment_status_history import AppointmentStatusHistory
from app.models.admin_user import AdminUser
from app.repositories import appointment_repository as appt_repo
from app.repositories import customer_repository as customer_repo
from app.repositories import service_repository as svc_repo
from app.repositories import slot_repository as slot_repo
from app.schemas.appointment_crm import AppointmentCRMCreate, AppointmentCRMUpdate
from app.services.session_service import SessionService

logger = logging.getLogger(__name__)


async def _write_status_history(
    db: AsyncSession,
    appointment_id: uuid.UUID,
    old_status: str | None,
    new_status: str,
    changed_by_id: uuid.UUID | None = None,
    reason: str | None = None,
    source: AppointmentSource | None = None,
    reschedule_source: AppointmentSource | None = None,
) -> None:
    entry = AppointmentStatusHistory(
        appointment_id=appointment_id,
        old_status=old_status,
        new_status=new_status,
        changed_by_id=changed_by_id,
        reason=reason,
        source=source,
        reschedule_source=reschedule_source,
    )
    db.add(entry)
    await db.flush()


async def create_appointment(
    db: AsyncSession,
    session_svc: SessionService,
    payload: AppointmentCRMCreate,
    created_by: AdminUser,
) -> Appointment:
    # 1. Get or create customer
    customer, _ = await customer_repo.get_or_create_by_phone(db, payload.user_phone)

    # 2. Redis soft lock
    acquired = await session_svc.acquire_slot_lock(str(payload.slot_id), payload.user_phone)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot is temporarily locked by another booking. Try again shortly.",
        )

    try:
        # 3. DB hard lock (SELECT FOR UPDATE NOWAIT)
        slot = await slot_repo.mark_slot_booked(db, payload.slot_id)
        if slot is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Slot is no longer available.",
            )

        # 4. Fetch service name BEFORE creating appointment (avoid lazy loading after flush)
        service = await svc_repo.get_service_by_id(db, payload.service_id)
        service_name = service.name if service else "Appointment"

        # 5. Create appointment
        appointment = await appt_repo.create_appointment_crm(
            db,
            user_phone=payload.user_phone,
            service_id=payload.service_id,
            slot_id=payload.slot_id,
            provider_id=payload.provider_id,
            customer_id=customer.id,
            notes=payload.notes,
            source=payload.source,
        )

        # 6. Status history: creation event (None → CONFIRMED)
        await _write_status_history(
            db,
            appointment_id=appointment.id,
            old_status=None,
            new_status=AppointmentStatus.CONFIRMED.value,
            changed_by_id=created_by.id,
            source=payload.source,
        )

        await db.flush()

    except HTTPException:
        await session_svc.release_slot_lock(str(payload.slot_id))
        raise
    except Exception:
        await session_svc.release_slot_lock(str(payload.slot_id))
        raise

    # 7. Release Redis lock (slot now hard-booked in DB)
    await session_svc.release_slot_lock(str(payload.slot_id))

    # 8. Commit the transaction BEFORE dispatching events
    await db.commit()

    # 9. Dispatch event (after commit so appointment exists in DB)
    slot_start = slot.start_time

    await event_dispatcher.dispatch(
        AppointmentCreatedEvent(
            appointment_id=appointment.id,
            user_phone=payload.user_phone,
            service_name=service_name,
            slot_start_time=slot_start,
            booking_ref=str(appointment.id),
        )
    )

    logger.info("CRM created appointment %s for %s", appointment.id, payload.user_phone)
    return appointment


async def cancel_appointment(
    db: AsyncSession,
    session_svc: SessionService,
    appointment_id: uuid.UUID,
    reason: str | None,
    cancelled_by: AdminUser,
    cancellation_source: AppointmentSource | None = None,
) -> Appointment:
    # 1. Load appointment with relations
    appointment = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    # 2. Verify it can be cancelled
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel appointment with status '{appointment.status.value}'",
        )

    old_status = appointment.status.value
    service_name = appointment.service.name if appointment.service else "Appointment"
    slot_start = appointment.slot.start_time if appointment.slot else None
    slot_id = appointment.slot_id

    # 3. Cancel via existing repo function (frees slot — do not duplicate this logic)
    updated = await appt_repo.cancel_appointment(db, appointment_id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Appointment could not be cancelled")

    # 4. Set cancellation reason and source
    if reason:
        updated.cancellation_reason = reason
    if cancellation_source:
        updated.cancellation_source = cancellation_source

    # 5. Status history
    await _write_status_history(
        db,
        appointment_id=appointment_id,
        old_status=old_status,
        new_status=AppointmentStatus.CANCELLED.value,
        changed_by_id=cancelled_by.id,
        reason=reason,
        # Use the cancellation_source from the request (who triggered this cancellation)
        source=cancellation_source,
    )

    # 6. Release Redis lock if present (harmless if not held)
    await session_svc.release_slot_lock(str(slot_id))

    # 7. Dispatch event
    if slot_start:
        await event_dispatcher.dispatch(
            AppointmentCancelledEvent(
                appointment_id=appointment_id,
                user_phone=appointment.user_phone,
                service_name=service_name,
                slot_start_time=slot_start,
                reason=reason,
            )
        )

    logger.info("CRM cancelled appointment %s (by %s)", appointment_id, cancelled_by.email)
    return updated


async def reschedule_appointment(
    db: AsyncSession,
    session_svc: SessionService,
    appointment_id: uuid.UUID,
    new_slot_id: uuid.UUID,
    reason: str | None,
    rescheduled_by: AdminUser,
    reschedule_source: AppointmentSource | None = None,
) -> Appointment:
    # 1. Load original appointment
    appointment = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reschedule appointment with status '{appointment.status.value}'",
        )

    service_name = appointment.service.name if appointment.service else "Appointment"
    old_slot_start = appointment.slot.start_time if appointment.slot else None
    old_slot_id = appointment.slot_id
    user_phone = appointment.user_phone
    service_id = appointment.service_id
    provider_id = appointment.provider_id
    customer_id = appointment.customer_id
    notes = appointment.notes

    # 2. Redis lock on new slot
    acquired = await session_svc.acquire_slot_lock(str(new_slot_id), user_phone)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="New slot is temporarily locked. Try again shortly.",
        )

    try:
        # 3. DB hard lock on new slot
        new_slot = await slot_repo.mark_slot_booked(db, new_slot_id)
        if new_slot is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="New slot is no longer available.",
            )

        # 4. Cancel old appointment (frees old slot)
        await appt_repo.cancel_appointment(db, appointment_id)
        await _write_status_history(
            db,
            appointment_id=appointment_id,
            old_status=AppointmentStatus.CONFIRMED.value,
            new_status=AppointmentStatus.CANCELLED.value,
            changed_by_id=rescheduled_by.id,
            reason=f"Rescheduled to slot {new_slot_id}",
            source=reschedule_source,
        )

        # 5. Create new appointment
        new_appointment = await appt_repo.create_appointment_crm(
            db,
            user_phone=user_phone,
            service_id=service_id,
            slot_id=new_slot_id,
            provider_id=provider_id,
            customer_id=customer_id,
            notes=notes,
        )
        new_appointment.rescheduled_from_slot_id = old_slot_id
        if reschedule_source:
            new_appointment.reschedule_source = reschedule_source

        await _write_status_history(
            db,
            appointment_id=new_appointment.id,
            old_status=None,
            new_status=AppointmentStatus.CONFIRMED.value,
            changed_by_id=rescheduled_by.id,
            reason=reason,
            source=reschedule_source,
            reschedule_source=reschedule_source,
        )

        await db.flush()

    except HTTPException:
        await session_svc.release_slot_lock(str(new_slot_id))
        raise
    except Exception:
        await session_svc.release_slot_lock(str(new_slot_id))
        raise

    # 6. Release Redis lock on new slot
    await session_svc.release_slot_lock(str(new_slot_id))

    # 7. Dispatch reschedule event
    if old_slot_start:
        await event_dispatcher.dispatch(
            AppointmentRescheduledEvent(
                appointment_id=new_appointment.id,
                user_phone=user_phone,
                service_name=service_name,
                old_slot_start_time=old_slot_start,
                new_slot_start_time=new_slot.start_time,
                booking_ref=str(new_appointment.id),
            )
        )

    logger.info(
        "CRM rescheduled appointment %s → new appointment %s (by %s)",
        appointment_id, new_appointment.id, rescheduled_by.email,
    )
    return new_appointment


async def update_appointment(
    db: AsyncSession,
    appointment_id: uuid.UUID,
    payload: AppointmentCRMUpdate,
    updated_by: AdminUser,
) -> Appointment:
    appointment = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    updates: dict = {}
    if payload.provider_id is not None:
        updates["provider_id"] = payload.provider_id
    if payload.notes is not None:
        updates["notes"] = payload.notes

    old_status = appointment.status.value
    if payload.status is not None and payload.status != appointment.status:
        updates["status"] = payload.status
        # Status updates via API are always from Admin
        await _write_status_history(
            db,
            appointment_id=appointment_id,
            old_status=old_status,
            new_status=payload.status.value,
            changed_by_id=updated_by.id,
            source=AppointmentSource.ADMIN_DASHBOARD,
        )
        await event_dispatcher.dispatch(
            AppointmentStatusChangedEvent(
                appointment_id=appointment_id,
                user_phone=appointment.user_phone,
                old_status=old_status,
                new_status=payload.status.value,
                service_name=appointment.service.name if appointment.service else "",
                slot_start_time=appointment.slot.start_time if appointment.slot else None,
            )
        )

    if updates:
        appointment = await appt_repo.update_appointment_fields(db, appointment_id, **updates)

    return appointment


async def mark_completed(
    db: AsyncSession,
    appointment_id: uuid.UUID,
    updated_by: AdminUser,
) -> Appointment:
    appointment = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appointment.status not in (AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark as completed from status '{appointment.status.value}'",
        )
    old_status = appointment.status.value
    await _write_status_history(
        db,
        appointment_id,
        old_status,
        AppointmentStatus.COMPLETED.value,
        updated_by.id,
        # Mark as completed via Admin (API action)
        source=AppointmentSource.ADMIN_DASHBOARD,
    )
    return await appt_repo.update_appointment_fields(
        db, appointment_id, status=AppointmentStatus.COMPLETED
    )


async def mark_no_show(
    db: AsyncSession,
    appointment_id: uuid.UUID,
    updated_by: AdminUser,
) -> Appointment:
    appointment = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark as no-show from status '{appointment.status.value}'",
        )
    old_status = appointment.status.value
    await _write_status_history(
        db,
        appointment_id,
        old_status,
        AppointmentStatus.NO_SHOW.value,
        updated_by.id,
        # Mark as no-show via Admin (API action)
        source=AppointmentSource.ADMIN_DASHBOARD,
    )
    return await appt_repo.update_appointment_fields(
        db, appointment_id, status=AppointmentStatus.NO_SHOW
    )
