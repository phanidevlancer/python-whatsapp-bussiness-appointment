import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_whatsapp_client, require_permission
from app.db.session import get_db
from app.repositories import appointment_repository as appt_repo
from app.repositories import notification_repository as notif_repo
from app.schemas.notification import NotificationLogListResponse, NotificationLogRead

router = APIRouter()


@router.get("/logs", response_model=NotificationLogListResponse)
async def list_notification_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    appointment_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("notifications.view")),
):
    items, total = await notif_repo.list_logs(
        db, page=page, page_size=page_size, appointment_id=appointment_id
    )
    return NotificationLogListResponse(
        items=[NotificationLogRead.model_validate(l) for l in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/resend/{appointment_id}")
async def resend_notification(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    wa_client=Depends(get_whatsapp_client),
    current_user=Depends(require_permission("notifications.manage")),
):
    from fastapi import HTTPException
    from app.db.session import AsyncSessionLocal
    from app.services.notification_service import NotificationService

    appt = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    svc = NotificationService(wa_client=wa_client, session_factory=AsyncSessionLocal)
    service_name = appt.service.name if appt.service else "Appointment"
    slot_start = appt.slot.start_time if appt.slot else None

    if slot_start:
        await svc.send_booking_confirmed(
            phone=appt.user_phone,
            appointment_id=appt.id,
            service_name=service_name,
            slot_start=slot_start,
            booking_ref=str(appt.id),
        )

    return {"status": "sent", "appointment_id": str(appointment_id)}
