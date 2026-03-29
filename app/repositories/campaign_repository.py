from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment, AppointmentStatus
from app.models.campaign import Campaign, CampaignStatus
from app.models.campaign_recipient import CampaignDeliveryStatus, CampaignRecipient
from app.models.campaign_send_log import CampaignSendLog
from app.repositories import customer_repository as customer_repo


async def get_campaign_by_id(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign | None:
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    return result.scalar_one_or_none()


async def get_campaign_by_id_for_update(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign | None:
    result = await db.execute(
        select(Campaign)
        .where(Campaign.id == campaign_id)
        .with_for_update()
    )
    return result.scalar_one_or_none()


async def get_campaign_by_code(db: AsyncSession, code: str) -> Campaign | None:
    result = await db.execute(select(Campaign).where(Campaign.code == code))
    return result.scalar_one_or_none()


async def get_campaign_by_button_id(db: AsyncSession, button_id: str) -> Campaign | None:
    result = await db.execute(select(Campaign).where(Campaign.booking_button_id == button_id))
    return result.scalar_one_or_none()


async def list_campaigns(db: AsyncSession) -> list[Campaign]:
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return list(result.scalars().all())


async def count_customer_campaign_bookings(
    db: AsyncSession,
    *,
    campaign_id: uuid.UUID,
    user_phone: str,
) -> int:
    normalized_phone = customer_repo.normalize_phone(user_phone)
    variants = [normalized_phone, f"+{normalized_phone}"]
    result = await db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.campaign_id == campaign_id,
            Appointment.user_phone.in_(variants),
            Appointment.status != AppointmentStatus.CANCELLED,
        )
    )
    return int(result.scalar_one() or 0)


async def list_active_campaigns(db: AsyncSession) -> list[Campaign]:
    result = await db.execute(
        select(Campaign)
        .where(Campaign.status == CampaignStatus.ACTIVE)
        .order_by(Campaign.created_at.desc())
    )
    return list(result.scalars().all())


async def bulk_create_recipients_from_drafts(
    db: AsyncSession,
    *,
    campaign: Campaign,
    drafts: list[object],
) -> list[CampaignRecipient]:
    existing_result = await db.execute(
        select(CampaignRecipient.phone).where(CampaignRecipient.campaign_id == campaign.id)
    )
    existing_phones = {phone for phone in existing_result.scalars().all()}

    created: list[CampaignRecipient] = []
    for draft in drafts:
        phone = getattr(draft, "phone", None)
        if not phone or phone in existing_phones:
            continue
        recipient = CampaignRecipient(
            campaign_id=campaign.id,
            customer_id=getattr(draft, "customer_id", None),
            phone=phone,
            customer_name=getattr(draft, "display_name", None),
            delivery_status=CampaignDeliveryStatus.PENDING,
        )
        db.add(recipient)
        created.append(recipient)
        existing_phones.add(phone)

    await db.flush()
    return created


async def list_pending_recipients(
    db: AsyncSession,
    *,
    campaign_id: uuid.UUID,
    limit: int,
) -> list[CampaignRecipient]:
    result = await db.execute(
        select(CampaignRecipient)
        .where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.delivery_status == CampaignDeliveryStatus.PENDING,
        )
        .order_by(CampaignRecipient.created_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    return list(result.scalars().all())


async def count_pending_recipients(db: AsyncSession, *, campaign_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(CampaignRecipient.id)).where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.delivery_status == CampaignDeliveryStatus.PENDING,
        )
    )
    return int(result.scalar_one() or 0)


async def update_recipient_status(
    db: AsyncSession,
    *,
    recipient: CampaignRecipient,
    delivery_status: CampaignDeliveryStatus,
    provider_message_id: str | None = None,
    error_message: str | None = None,
) -> CampaignRecipient:
    del provider_message_id

    now = datetime.now(timezone.utc)
    recipient.delivery_status = delivery_status
    recipient.last_error = error_message

    if delivery_status == CampaignDeliveryStatus.SENT:
        recipient.sent_at = now
        recipient.failed_at = None
    elif delivery_status == CampaignDeliveryStatus.FAILED:
        recipient.failed_at = now
    elif delivery_status == CampaignDeliveryStatus.DELIVERED:
        recipient.delivered_at = now
    elif delivery_status == CampaignDeliveryStatus.READ:
        recipient.read_at = now
    elif delivery_status == CampaignDeliveryStatus.CLICKED:
        recipient.clicked_at = now
    elif delivery_status == CampaignDeliveryStatus.SKIPPED:
        recipient.skipped_at = now

    await db.flush()
    return recipient


async def mark_campaign_recipient_clicked(
    db: AsyncSession,
    *,
    campaign_id: uuid.UUID,
    user_phone: str,
) -> CampaignRecipient | None:
    normalized_phone = customer_repo.normalize_phone(user_phone)
    phone_variants = {normalized_phone, f"+{normalized_phone}"}

    result = await db.execute(
        select(CampaignRecipient)
        .where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.phone.in_(phone_variants),
        )
        .order_by(CampaignRecipient.created_at.desc())
        .limit(1)
    )
    recipient = result.scalar_one_or_none()
    if recipient is None:
        return None

    return await update_recipient_status(
        db,
        recipient=recipient,
        delivery_status=CampaignDeliveryStatus.CLICKED,
    )


async def create_send_log(
    db: AsyncSession,
    *,
    campaign_id: uuid.UUID,
    recipient_id: uuid.UUID,
    provider_message_id: str | None,
    status: CampaignDeliveryStatus,
    sent_at: datetime | None,
    error_message: str | None,
) -> CampaignSendLog:
    send_log = CampaignSendLog(
        campaign_id=campaign_id,
        recipient_id=recipient_id,
        provider_message_id=provider_message_id,
        status=status,
        sent_at=sent_at,
        error_message=error_message,
    )
    db.add(send_log)
    await db.flush()
    return send_log


def _status_key(value: object | None) -> str | None:
    return getattr(value, "value", value)


def _run_status(campaign: Campaign, pending_count: int) -> str:
    status_value = _status_key(getattr(campaign, "status", None))
    if status_value == "paused":
        return "paused"
    if getattr(campaign, "failed_at", None):
        return "failed"
    if getattr(campaign, "completed_at", None):
        return "completed"
    if getattr(campaign, "started_at", None):
        return "running" if pending_count > 0 else "completed"
    return "draft"


def _delivery_metrics(recipients: list[CampaignRecipient]) -> dict[str, int]:
    metrics = {
        "targeted": len(recipients),
        "pending": 0,
        "sent": 0,
        "delivered": 0,
        "read": 0,
        "clicked": 0,
        "failed": 0,
        "skipped": 0,
    }
    for recipient in recipients:
        status_key = _status_key(recipient.delivery_status)
        if status_key == CampaignDeliveryStatus.PENDING.value:
            metrics["pending"] += 1
        elif status_key == CampaignDeliveryStatus.SENT.value:
            metrics["sent"] += 1
        elif status_key == CampaignDeliveryStatus.DELIVERED.value:
            metrics["sent"] += 1
            metrics["delivered"] += 1
        elif status_key == CampaignDeliveryStatus.READ.value:
            metrics["sent"] += 1
            metrics["delivered"] += 1
            metrics["read"] += 1
        elif status_key == CampaignDeliveryStatus.CLICKED.value:
            metrics["sent"] += 1
            metrics["delivered"] += 1
            metrics["read"] += 1
            metrics["clicked"] += 1
        elif status_key == CampaignDeliveryStatus.FAILED.value:
            metrics["failed"] += 1
        elif status_key == CampaignDeliveryStatus.SKIPPED.value:
            metrics["skipped"] += 1
    return metrics


def _appointment_metrics(appointments: list[Appointment]) -> dict[str, object]:
    metrics: dict[str, object] = {
        "bookings": len(appointments),
        "confirmed": 0,
        "cancelled": 0,
        "completed": 0,
        "no_show": 0,
        "total_service_value": Decimal("0.00"),
        "total_final_value": Decimal("0.00"),
    }
    for appointment in appointments:
        status_key = _status_key(getattr(appointment, "status", None))
        if status_key in {"confirmed", "cancelled", "completed", "no_show"}:
            metrics[status_key] += 1
        service_value = Decimal(str(getattr(appointment, "service_cost_snapshot", None) or Decimal("0.00")))
        final_value = getattr(appointment, "final_cost_snapshot", None)
        metrics["total_service_value"] += service_value
        metrics["total_final_value"] += Decimal(str(final_value if final_value is not None else service_value))
    return metrics


async def _load_campaign_recipients(db: AsyncSession, *, campaign_id: uuid.UUID) -> list[CampaignRecipient]:
    result = await db.execute(
        select(CampaignRecipient)
        .where(CampaignRecipient.campaign_id == campaign_id)
        .options(selectinload(CampaignRecipient.send_logs))
        .order_by(CampaignRecipient.created_at.asc())
    )
    return list(result.scalars().all())


async def _load_campaign_appointments(db: AsyncSession, *, campaign_id: uuid.UUID) -> list[Appointment]:
    result = await db.execute(
        select(Appointment)
        .where(Appointment.campaign_id == campaign_id)
        .order_by(Appointment.created_at.asc())
    )
    return list(result.scalars().all())


def _recipient_appointment_index(
    recipients: list[CampaignRecipient],
    appointments: list[Appointment],
) -> dict[uuid.UUID, list[Appointment]]:
    by_customer_id: dict[uuid.UUID, list[Appointment]] = defaultdict(list)
    by_phone: dict[str, list[Appointment]] = defaultdict(list)

    for appointment in appointments:
        customer_id = getattr(appointment, "customer_id", None)
        if customer_id:
            by_customer_id[customer_id].append(appointment)
        phone = customer_repo.normalize_phone(str(getattr(appointment, "user_phone", "") or ""))
        if phone:
            by_phone[phone].append(appointment)

    appointment_map: dict[uuid.UUID, list[Appointment]] = {}
    for recipient in recipients:
        normalized_phone = customer_repo.normalize_phone(recipient.phone)
        matches: list[Appointment] = []
        seen_ids: set[uuid.UUID] = set()
        for appointment in by_customer_id.get(recipient.customer_id, []):
            if appointment.id in seen_ids:
                continue
            matches.append(appointment)
            seen_ids.add(appointment.id)
        for appointment in by_phone.get(normalized_phone, []):
            if appointment.id in seen_ids:
                continue
            matches.append(appointment)
            seen_ids.add(appointment.id)
        appointment_map[recipient.id] = matches

    return appointment_map


def _serialize_send_log(send_log: CampaignSendLog) -> dict[str, object]:
    return {
        "id": str(send_log.id),
        "campaign_id": str(send_log.campaign_id),
        "recipient_id": str(send_log.recipient_id),
        "provider_message_id": send_log.provider_message_id,
        "status": _status_key(send_log.status),
        "sent_at": send_log.sent_at,
        "delivered_at": send_log.delivered_at,
        "read_at": send_log.read_at,
        "clicked_at": send_log.clicked_at,
        "error_message": send_log.error_message,
        "created_at": send_log.created_at,
        "updated_at": send_log.updated_at,
    }


def _serialize_recipient(
    recipient: CampaignRecipient,
    *,
    appointments: list[Appointment],
) -> dict[str, object]:
    appointment_metrics = _appointment_metrics(appointments)
    return {
        "id": str(recipient.id),
        "campaign_id": str(recipient.campaign_id),
        "customer_id": str(recipient.customer_id) if recipient.customer_id else None,
        "phone": recipient.phone,
        "customer_name": recipient.customer_name,
        "delivery_status": _status_key(recipient.delivery_status),
        "sent_at": recipient.sent_at,
        "delivered_at": recipient.delivered_at,
        "read_at": recipient.read_at,
        "clicked_at": recipient.clicked_at,
        "failed_at": recipient.failed_at,
        "skipped_at": recipient.skipped_at,
        "last_error": recipient.last_error,
        "booking_metrics": {
            "bookings": appointment_metrics["bookings"],
            "confirmed": appointment_metrics["confirmed"],
            "cancelled": appointment_metrics["cancelled"],
            "completed": appointment_metrics["completed"],
            "no_show": appointment_metrics["no_show"],
        },
        "send_logs": [_serialize_send_log(send_log) for send_log in sorted(recipient.send_logs, key=lambda item: item.created_at)],
        "created_at": recipient.created_at,
        "updated_at": recipient.updated_at,
    }


async def list_campaign_recipients(db: AsyncSession, *, campaign_id: uuid.UUID) -> dict[str, object] | None:
    campaign = await get_campaign_by_id(db, campaign_id)
    if campaign is None:
        return None

    recipients = await _load_campaign_recipients(db, campaign_id=campaign_id)
    appointments = await _load_campaign_appointments(db, campaign_id=campaign_id)
    recipient_appointments = _recipient_appointment_index(recipients, appointments)
    metrics = _delivery_metrics(recipients)
    booking_metrics = _appointment_metrics(appointments)
    metrics.update(booking_metrics)

    return {
        "campaign_id": str(campaign.id),
        "run_status": _run_status(campaign, metrics["pending"]),
        "metrics": metrics,
        "items": [
            _serialize_recipient(recipient, appointments=recipient_appointments.get(recipient.id, []))
            for recipient in recipients
        ],
    }


async def get_campaign_detail(db: AsyncSession, *, campaign_id: uuid.UUID) -> dict[str, object] | None:
    campaign = await get_campaign_by_id(db, campaign_id)
    if campaign is None:
        return None

    recipients_payload = await list_campaign_recipients(db, campaign_id=campaign_id)
    if recipients_payload is None:
        return None

    metrics = recipients_payload["metrics"]
    return {
        "id": str(campaign.id),
        "code": campaign.code,
        "name": campaign.name,
        "description": campaign.description,
        "status": _status_key(campaign.status),
        "run_status": _run_status(campaign, metrics["pending"]),
        "audience": {
            "type": _status_key(campaign.audience_type),
            "filters": campaign.audience_filters or {},
        },
        "message": {
            "body": campaign.message_body,
            "footer": campaign.message_footer,
            "button_label": campaign.button_label,
            "booking_button_id": campaign.booking_button_id,
            "image_path": campaign.image_path,
            "image_media_id": campaign.image_media_id,
        },
        "batch": {
            "size": campaign.batch_size,
            "delay_seconds": campaign.batch_delay_seconds,
        },
        "lifecycle": {
            "started_at": campaign.started_at,
            "completed_at": campaign.completed_at,
            "failed_at": campaign.failed_at,
            "last_error": campaign.last_error,
        },
        "metrics": metrics,
        "source_comparison": [
            {
                "source": "campaign",
                **metrics,
            },
            {
                "source": "organic",
                "targeted": 0,
                "pending": 0,
                "sent": 0,
                "delivered": 0,
                "read": 0,
                "clicked": 0,
                "failed": 0,
                "skipped": 0,
                "bookings": 0,
                "confirmed": 0,
                "cancelled": 0,
                "completed": 0,
                "no_show": 0,
                "total_service_value": Decimal("0.00"),
                "total_final_value": Decimal("0.00"),
            },
        ],
        "recipients": recipients_payload["items"],
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
    }
