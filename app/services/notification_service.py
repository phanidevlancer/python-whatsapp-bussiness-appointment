"""
Centralized WhatsApp notification gateway.

ALL WhatsApp sends from the CRM flow through this service.
Never call whatsapp_client directly from route handlers or appointment_crm_service.

Design:
- Each send method builds the message text, calls _send_and_log()
- _send_and_log() creates a PENDING WhatsAppMessageLog, calls wa_client.send_text(),
  then updates the log to SENT or FAILED — using its own DB session since the
  appointment transaction may already be committed by the time this runs.
- Module-level init + event handler functions are registered in main.py lifespan.
"""
import json
import logging
import uuid
from datetime import datetime

from app.events.appointment_events import (
    AppointmentCancelledEvent,
    AppointmentCreatedEvent,
    AppointmentRescheduledEvent,
)
from app.integrations.whatsapp_client import WhatsAppAPIError, WhatsAppClient

logger = logging.getLogger(__name__)

_notification_svc: "NotificationService | None" = None


class NotificationService:
    def __init__(self, wa_client: WhatsAppClient, session_factory) -> None:
        self._wa_client = wa_client
        self._session_factory = session_factory

    async def send_booking_confirmed(
        self,
        phone: str,
        appointment_id: uuid.UUID | None,
        service_name: str,
        slot_start: datetime,
        booking_ref: str,
    ) -> None:
        slot_str = slot_start.strftime("%A, %B %d at %I:%M %p")
        text = (
            f"✅ *Appointment Confirmed*\n\n"
            f"Service: {service_name}\n"
            f"Date/Time: {slot_str}\n"
            f"Ref: #{str(booking_ref)[:8].upper()}\n\n"
            f"Please arrive 5 minutes early. Reply 'my appointments' to manage."
        )
        await self._send_and_log(
            phone=phone,
            appointment_id=appointment_id,
            message_type="booking_confirmed",
            text_body=text,
            payload={"service": service_name, "slot_start": slot_start.isoformat()},
        )

    async def send_booking_cancelled(
        self,
        phone: str,
        appointment_id: uuid.UUID | None,
        service_name: str,
        slot_start: datetime,
        reason: str | None = None,
    ) -> None:
        slot_str = slot_start.strftime("%A, %B %d at %I:%M %p")
        text = (
            f"❌ *Appointment Cancelled*\n\n"
            f"Service: {service_name}\n"
            f"Date/Time: {slot_str}\n"
        )
        if reason:
            text += f"Reason: {reason}\n"
        text += "\nTo book a new appointment, reply 'book'."
        await self._send_and_log(
            phone=phone,
            appointment_id=appointment_id,
            message_type="booking_cancelled",
            text_body=text,
            payload={"service": service_name, "slot_start": slot_start.isoformat(), "reason": reason},
        )

    async def send_booking_rescheduled(
        self,
        phone: str,
        appointment_id: uuid.UUID | None,
        service_name: str,
        old_slot_start: datetime,
        new_slot_start: datetime,
        booking_ref: str,
    ) -> None:
        old_str = old_slot_start.strftime("%A, %B %d at %I:%M %p")
        new_str = new_slot_start.strftime("%A, %B %d at %I:%M %p")
        text = (
            f"🔄 *Appointment Rescheduled*\n\n"
            f"Service: {service_name}\n"
            f"Previous: {old_str}\n"
            f"New: {new_str}\n"
            f"Ref: #{str(booking_ref)[:8].upper()}\n\n"
            f"Reply 'my appointments' to manage your bookings."
        )
        await self._send_and_log(
            phone=phone,
            appointment_id=appointment_id,
            message_type="booking_rescheduled",
            text_body=text,
            payload={
                "service": service_name,
                "old_slot_start": old_slot_start.isoformat(),
                "new_slot_start": new_slot_start.isoformat(),
            },
        )

    async def send_reminder(
        self,
        phone: str,
        appointment_id: uuid.UUID | None,
        service_name: str,
        slot_start: datetime,
    ) -> None:
        slot_str = slot_start.strftime("%A, %B %d at %I:%M %p")
        text = (
            f"⏰ *Appointment Reminder*\n\n"
            f"You have {service_name} scheduled for {slot_str}.\n\n"
            f"Reply 'my appointments' to cancel or reschedule."
        )
        await self._send_and_log(
            phone=phone,
            appointment_id=appointment_id,
            message_type="reminder",
            text_body=text,
            payload={"service": service_name, "slot_start": slot_start.isoformat()},
        )

    async def _send_and_log(
        self,
        phone: str,
        appointment_id: uuid.UUID | None,
        message_type: str,
        text_body: str,
        payload: dict,
    ) -> None:
        from app.repositories import notification_repository as notif_repo

        # Open a fresh session — the appointment transaction may already be committed
        async with self._session_factory() as db:
            log = await notif_repo.create_log(
                db,
                customer_phone=phone,
                message_type=message_type,
                appointment_id=appointment_id,
                payload_json=json.dumps(payload),
            )
            log_id = log.id
            await db.commit()

        # Send the message
        try:
            await self._wa_client.send_text(to=phone, body=text_body)
            async with self._session_factory() as db:
                await notif_repo.mark_sent(db, log_id)
                await db.commit()
            logger.info("WhatsApp %s sent to %s (log_id=%s)", message_type, phone, log_id)
        except (WhatsAppAPIError, Exception) as exc:
            error_msg = str(exc)
            logger.error(
                "WhatsApp send failed (type=%s phone=%s): %s", message_type, phone, error_msg
            )
            async with self._session_factory() as db:
                await notif_repo.mark_failed(db, log_id, error_msg)
                await db.commit()


# ---------------------------------------------------------------------------
# Module-level init + event handlers (registered in main.py lifespan)
# ---------------------------------------------------------------------------

def init_notification_service(wa_client: WhatsAppClient, session_factory) -> None:
    global _notification_svc
    _notification_svc = NotificationService(wa_client, session_factory)
    logger.info("NotificationService initialized")


async def on_appointment_created(event: AppointmentCreatedEvent) -> None:
    if _notification_svc:
        await _notification_svc.send_booking_confirmed(
            phone=event.user_phone,
            appointment_id=event.appointment_id,
            service_name=event.service_name,
            slot_start=event.slot_start_time,
            booking_ref=str(event.appointment_id),
        )


async def on_appointment_cancelled(event: AppointmentCancelledEvent) -> None:
    if _notification_svc:
        await _notification_svc.send_booking_cancelled(
            phone=event.user_phone,
            appointment_id=event.appointment_id,
            service_name=event.service_name,
            slot_start=event.slot_start_time,
            reason=event.reason,
        )


async def on_appointment_rescheduled(event: AppointmentRescheduledEvent) -> None:
    if _notification_svc:
        await _notification_svc.send_booking_rescheduled(
            phone=event.user_phone,
            appointment_id=event.appointment_id,
            service_name=event.service_name,
            old_slot_start=event.old_slot_start_time,
            new_slot_start=event.new_slot_start_time,
            booking_ref=str(event.appointment_id),
        )
