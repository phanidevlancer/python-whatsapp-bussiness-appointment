"""
Booking flow state machine.

Booking state transitions:
  START / BOOKED  ──(greeting)──►  SERVICE_SELECTED   (shows service list)
  SERVICE_SELECTED ──(list reply)──► SLOT_SELECTED    (shows slot list)
  SLOT_SELECTED   ──(list reply)──►  SLOT_SELECTED    (acquire lock, show confirm btn)
  SLOT_SELECTED   ──(confirm btn)──► BOOKED           (DB transaction, confirmation msg)
  SLOT_SELECTED   ──(cancel btn)──►  START            (resets session)
  any state        ──(greeting)──►  SERVICE_SELECTED   (always restarts the flow)

Manage state transitions:
  any state        ──(manage kw)──►  MANAGE_MENU      (shows upcoming appointments list)
  MANAGE_MENU      ──(list reply)──► MANAGE_APPOINTMENT (shows cancel/reschedule buttons)
  MANAGE_APPOINTMENT ──(cancel btn)──► BOOKED         (cancels, sends confirmation)
  MANAGE_APPOINTMENT ──(reschedule btn)──► RESCHEDULE_SLOT (shows slot list for same service)
  RESCHEDULE_SLOT  ──(list reply)──► RESCHEDULE_SLOT  (acquire lock, show confirm btn)
  RESCHEDULE_SLOT  ──(confirm btn)──► BOOKED          (cancels old, books new, sends confirmation)
  RESCHEDULE_SLOT  ──(cancel btn)──►  MANAGE_MENU     (back to appointments list)
"""
import logging
import uuid

from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

import uuid as _uuid

from app.core.config import settings
from app.integrations.whatsapp_client import WhatsAppClient, WhatsAppAPIError
from app.models.user_session import SessionStep

# Steps that are meaningful enough to capture as a lead when user abandons flow
CAPTURABLE_STEPS = {
    SessionStep.SERVICE_SELECTED,
    SessionStep.SLOT_SELECTED,
    SessionStep.AWAITING_NAME,
    SessionStep.AWAITING_EMAIL,
}

from app.repositories import (
    appointment_repository as appt_repo,
    campaign_repository as campaign_repo,
    customer_repository as customer_repo,
    service_repository as svc_repo,
    session_repository as sess_repo,
    slot_repository as slot_repo,
)
from app.services import campaign_service
from app.services.session_service import SessionService
from app.utils.whatsapp_parser import (
    MessageType,
    extract_message,
    extract_sender_phone,
    extract_whatsapp_profile_name,
    get_button_reply_id,
    get_flow_reply_data,
    get_list_reply_id,
    get_message_id,
    get_message_type,
    get_text_body,
    is_greeting,
    is_manage_request,
)

logger = logging.getLogger(__name__)

_SEP = "─" * 60

# IST = UTC+05:30
from datetime import timezone as _tz, timedelta as _td
_IST = _tz(_td(hours=5, minutes=30), name="IST")


def _to_ist(dt) -> "datetime":
    """Convert a datetime to IST (UTC+05:30) for display."""
    from datetime import datetime
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_tz.utc)
    return dt.astimezone(_IST)


_FLOW_LABEL = {
    "START":                "New Booking",
    "SERVICE_SELECTED":     "New Booking  — selecting service",
    "SLOT_SELECTED":        "New Booking  — selecting slot",
    "BOOKED":               "New Booking  — completed",
    "MANAGE_MENU":          "Manage Appointments",
    "MANAGE_APPOINTMENT":   "Manage Appointments — appointment selected",
    "RESCHEDULE_SLOT":      "Reschedule   — selecting new slot",
}


def _log_incoming(
    sender: str,
    msg_type,
    step: str,
    text_body: str | None,
    message: dict,
    user_session=None,
    service_name: str | None = None,
) -> None:
    """Log a full-context block for every incoming message."""
    # --- What the user said ---
    if msg_type.value == "text":
        user_msg = f'"{text_body}"'
    elif msg_type.value == "list_reply":
        try:
            title = message["interactive"]["list_reply"].get("title", "")
            desc  = message["interactive"]["list_reply"].get("description", "")
            user_msg = f'selected "{title}"' + (f'  ({desc})' if desc else "")
        except (KeyError, TypeError):
            user_msg = "selected (list)"
    elif msg_type.value == "button_reply":
        try:
            title = message["interactive"]["button_reply"].get("title", "")
            user_msg = f'tapped "{title}"'
        except (KeyError, TypeError):
            user_msg = "tapped (button)"
    else:
        user_msg = f"({msg_type.value})"

    # --- Flow context ---
    flow = _FLOW_LABEL.get(step, step)

    # --- Session context lines (only when we have useful info) ---
    ctx_lines = []
    if service_name:
        ctx_lines.append(f"  Service : {service_name}")
    if user_session is not None:
        if getattr(user_session, "selected_slot_id", None):
            ctx_lines.append(f"  Slot ID : {str(user_session.selected_slot_id)[:8]}…")
        if getattr(user_session, "selected_appointment_id", None):
            ctx_lines.append(f"  Appt ID : {str(user_session.selected_appointment_id)[:8]}…")

    ctx_block = ("\n" + "\n".join(ctx_lines)) if ctx_lines else ""

    logger.info(
        "\n%s\n  From  : %s\n  Flow  : %s\n  Msg   : %s%s\n%s",
        _SEP, sender, flow, user_msg, ctx_block, _SEP,
    )


def _log_action(sender: str, action: str) -> None:
    """Log what the bot did in response."""
    logger.info("  ↳ Bot : %s", action)


async def handle_incoming_message(
    payload: dict,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
) -> None:
    """
    Entry point for all incoming WhatsApp messages.
    Wraps the entire flow in a try/except so errors never propagate to the webhook
    router (which must always return 200 to Meta).
    """
    try:
        await _process_message(payload, db, session_svc, wa_client)
    except Exception as e:
        logger.exception("Unhandled error in booking flow: %s", e)


async def _process_message(
    payload: dict,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
) -> None:
    message = extract_message(payload)
    if message is None:
        return  # status update (delivery/read receipt), nothing to process

    sender = extract_sender_phone(payload)
    if not sender:
        logger.warning("Could not extract sender phone from payload")
        return

    whatsapp_name = extract_whatsapp_profile_name(payload)

    message_id = get_message_id(message)
    msg_type = get_message_type(message)

    # --- Idempotency: skip already-processed messages ---
    if message_id and await session_svc.is_duplicate_message(message_id):
        logger.debug("Skipping duplicate message id=%s", message_id)
        return

    # --- Load or create session ---
    user_session = await sess_repo.get_or_create_session(db, sender)
    text_body = get_text_body(message)
    
    # --- Check for expired session and capture lead if needed ---
    from datetime import datetime, timezone, timedelta
    from app.core.config import settings
    
    # Check if session has expired (idle for more than SESSION_TTL_SECONDS)
    # Use created_at as fallback if updated_at is not reliable
    session_updated = user_session.updated_at or user_session.created_at or datetime.now(timezone.utc)
    if session_updated.tzinfo is None:
        session_updated = session_updated.replace(tzinfo=timezone.utc)
    
    session_age = (datetime.now(timezone.utc) - session_updated).total_seconds()
    is_session_expired = session_age > settings.SESSION_TTL_SECONDS
    
    # Capture lead if session expired and user was in a capturable step
    # But NOT if they're starting fresh (START step)
    if is_session_expired and user_session.current_step in CAPTURABLE_STEPS:
        try:
            from app.services.lead_service import capture_drop_off
            await capture_drop_off(db, user_session)
            # Reset the session after capturing lead
            await sess_repo.reset_session(db, sender)
            await db.commit()
            logger.info("Captured lead for expired session: phone=%s age=%.0fs step=%s", sender, session_age, user_session.current_step.value)
            # After capturing and resetting, continue with fresh session
            user_session = await sess_repo.get_or_create_session(db, sender)
        except Exception:
            logger.exception("Failed to capture drop-off for expired session %s", sender)
            await db.rollback()

    # --- Load or create customer, seeding name from WhatsApp profile ---
    _customer, _ = await customer_repo.get_or_create_by_phone(db, sender, whatsapp_name=whatsapp_name)
    uname: str | None = _customer.name.title() if _customer.name else None

    # Resolve service name once for the log block (cheap: already in identity map if loaded)
    _svc_name: str | None = None
    if user_session.selected_service_id is not None:
        _svc = await svc_repo.get_service_by_id(db, user_session.selected_service_id)
        _svc_name = _svc.name if _svc else None

    _log_incoming(
        sender, msg_type, user_session.current_step.value,
        text_body, message, user_session=user_session, service_name=_svc_name,
    )

    # --- Manage flow keyword — works from any state ---
    if msg_type == MessageType.TEXT and is_manage_request(text_body):
        await _handle_manage_menu(sender, db, wa_client, uname)
        return

    # --- Button clicks for quick actions ---
    if msg_type == MessageType.BUTTON_REPLY:
        button_id = get_button_reply_id(message)
        campaign_code = campaign_service.parse_campaign_button_id(button_id)
        if campaign_code:
            campaign = await campaign_repo.get_campaign_by_code(db, campaign_code)
            if campaign and campaign_service.is_campaign_active(campaign):
                existing_count = await campaign_repo.count_customer_campaign_bookings(
                    db,
                    campaign_id=campaign.id,
                    user_phone=sender,
                )
                if campaign_service.is_booking_limit_reached(campaign, existing_count=existing_count):
                    await _send_campaign_limit_reached(sender, wa_client, campaign.name)
                    if message_id:
                        await session_svc.mark_message_processed(message_id)
                    return
                await campaign_repo.mark_campaign_recipient_clicked(
                    db,
                    campaign_id=campaign.id,
                    user_phone=sender,
                )
                await campaign_service.start_campaign_journey(
                    db,
                    sender,
                    campaign=campaign,
                    entry_point="button_campaign",
                    entry_message_id=message_id,
                )
                await _handle_greeting(sender, db, wa_client, uname)
                if message_id:
                    await session_svc.mark_message_processed(message_id)
            else:
                await campaign_service.start_organic_journey(
                    db,
                    sender,
                    entry_point="campaign_fallback",
                    entry_message_id=message_id,
                )
                await wa_client.send_text(
                    sender,
                    "That offer is no longer available. Send *hi* to browse our standard booking options.",
                )
                if message_id:
                    await session_svc.mark_message_processed(message_id)
            return
        if button_id == "book_appointment":
            await campaign_service.start_organic_journey(
                db,
                sender,
                entry_point="button_organic",
                entry_message_id=message_id,
            )
            await _handle_greeting(sender, db, wa_client, uname)
            if message_id:
                await session_svc.mark_message_processed(message_id)
            return
        if button_id == "my_appointments":
            await _handle_manage_menu(sender, db, wa_client, uname)
            if message_id:
                await session_svc.mark_message_processed(message_id)
            return
        if button_id == "update_name":
            await _handle_update_name_prompt(sender, db, wa_client, uname)
            if message_id:
                await session_svc.mark_message_processed(message_id)
            return

    # --- Greeting always shows the main menu buttons ---
    if msg_type == MessageType.TEXT and is_greeting(text_body):
        await campaign_service.start_organic_journey(
            db,
            sender,
            entry_point="text_hi",
            entry_message_id=message_id,
        )
        await _handle_main_menu(sender, db, wa_client, uname)
        return

    # --- Route by state ---
    step = user_session.current_step

    if step in (SessionStep.START, SessionStep.BOOKED):
        await _handle_main_menu(sender, db, wa_client, uname)

    elif step == SessionStep.SERVICE_SELECTED:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_service_selection(sender, get_list_reply_id(message), db, wa_client, uname)
        else:
            await wa_client.send_text(sender, f"Please select a service from the list below{', ' + uname if uname else ''}.")

    elif step == SessionStep.SLOT_SELECTED:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_slot_selection(sender, get_list_reply_id(message), db, session_svc, wa_client, uname)
        elif msg_type == MessageType.BUTTON_REPLY:
            button_id = get_button_reply_id(message)
            if button_id.startswith("confirm_"):
                slot_id_str = button_id[len("confirm_"):]
                await _handle_booking_confirmation(sender, slot_id_str, db, session_svc, wa_client, uname)
            elif button_id == "cancel_booking":
                await _handle_cancel(sender, db, wa_client, uname)
            else:
                await wa_client.send_text(sender, "Please use the buttons to confirm or cancel.")
        else:
            await wa_client.send_text(sender, "Please select a time slot from the list below.")

    elif step == SessionStep.MANAGE_MENU:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_appointment_selection(sender, get_list_reply_id(message), db, wa_client, uname)
        else:
            await wa_client.send_text(sender, "Please select an appointment from the list below.")

    elif step == SessionStep.MANAGE_APPOINTMENT:
        if msg_type == MessageType.BUTTON_REPLY:
            button_id = get_button_reply_id(message)
            if button_id.startswith("cancel_appt_"):
                appt_id_str = button_id[len("cancel_appt_"):]
                await _handle_appointment_cancel(sender, appt_id_str, db, session_svc, wa_client, uname)
            elif button_id.startswith("reschedule_"):
                appt_id_str = button_id[len("reschedule_"):]
                await _handle_reschedule_start(sender, appt_id_str, db, wa_client, uname)
            elif button_id == "back_to_menu":
                await _handle_manage_menu(sender, db, wa_client, uname)
            else:
                await wa_client.send_text(sender, "Please use the buttons to choose an action.")
        else:
            await wa_client.send_text(sender, "Please use the buttons to choose an action.")

    elif step == SessionStep.UPDATING_NAME:
        if msg_type == MessageType.TEXT and text_body:
            await _handle_save_updated_name(sender, text_body.strip(), db, wa_client)
        else:
            await wa_client.send_text(sender, "Please reply with your new name.")

    elif step == SessionStep.AWAITING_NAME:
        if msg_type == MessageType.FLOW_REPLY:
            await _handle_flow_submission(sender, get_flow_reply_data(message), db, wa_client)
        elif msg_type == MessageType.TEXT and text_body:
            await _handle_text_name(sender, text_body.strip(), db, wa_client)
        else:
            await _send_details_flow(sender, wa_client)

    elif step == SessionStep.AWAITING_EMAIL:
        if msg_type == MessageType.TEXT and text_body:
            await _handle_text_email(sender, text_body.strip(), db, wa_client, uname)
        else:
            await wa_client.send_text(sender, f"Please reply with your email{', ' + uname if uname else ''}, or type *skip* to skip.")

    elif step == SessionStep.RESCHEDULE_SLOT:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_reschedule_slot_selection(sender, get_list_reply_id(message), db, session_svc, wa_client, uname)
        elif msg_type == MessageType.BUTTON_REPLY:
            button_id = get_button_reply_id(message)
            if button_id.startswith("confirm_reschedule_"):
                slot_id_str = button_id[len("confirm_reschedule_"):]
                await _handle_reschedule_confirmation(sender, slot_id_str, db, session_svc, wa_client, uname)
            elif button_id == "cancel_reschedule":
                await _handle_manage_menu(sender, db, wa_client, uname)
            else:
                await wa_client.send_text(sender, "Please use the buttons to confirm or go back.")
        else:
            await wa_client.send_text(sender, "Please select a new time slot from the list below.")


# ---------------------------------------------------------------------------
# Booking step handlers
# ---------------------------------------------------------------------------

async def _handle_main_menu(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient, uname: str | None = None
) -> None:
    """Show the main menu with 2 options: Book an appointment / My appointments."""
    # Capture drop-off if the user was mid-flow before resetting
    existing_session = await sess_repo.get_or_create_session(db, sender)
    if existing_session.current_step in CAPTURABLE_STEPS:
        try:
            from app.services.lead_service import capture_drop_off
            await capture_drop_off(db, existing_session)
        except Exception:
            logger.exception("Failed to capture drop-off for %s", sender)

    await sess_repo.reset_session(db, sender)
    await db.commit()
    _log_action(sender, "Sent main menu buttons")

    greeting = f"Welcome back, *{uname}*! 👋" if uname else "Welcome to *ORA Clinic*! 👋"
    body = f"{greeting}\n\nWe're here to help you with your healthcare needs. How can we assist you today?"

    buttons = [
        {"id": "book_appointment", "title": "Book an appointment"},
        {"id": "my_appointments", "title": "My appointments"},
        {"id": "update_name", "title": "Update my name"},
    ]

    await wa_client.send_button_message(to=sender, body=body, buttons=buttons)


async def _send_campaign_limit_reached(
    sender: str,
    wa_client: WhatsAppClient,
    campaign_name: str,
) -> None:
    _log_action(sender, f"Campaign limit reached for {campaign_name} — sent My Bookings shortcut")
    await wa_client.send_button_message(
        to=sender,
        body=(
            f"You have already availed the *{campaign_name}* offer.\n\n"
            "Please check your existing booking using the button below."
        ),
        buttons=[
            {"id": "my_appointments", "title": "My Bookings"},
            {"id": "book_appointment", "title": "Book Organic"},
        ],
    )


async def _handle_greeting(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient, uname: str | None = None
) -> None:
    """Show the service selection list (called when user taps 'Book an appointment')."""
    services = await svc_repo.get_active_services_with_providers(db)
    user_session = await sess_repo.get_or_create_session(db, sender)
    active_campaign = await campaign_service.resolve_active_campaign(db, user_session)

    if active_campaign is not None and campaign_service.is_campaign_active(active_campaign):
        services = [
            service for service in services
            if campaign_service.is_service_eligible(active_campaign, service.id)
        ]

    if not services:
        await wa_client.send_text(
            sender,
            "We're sorry, but *ORA Clinic* has no services available right now. Please try again later.",
        )
        return

    await sess_repo.update_session(db, sender, SessionStep.SERVICE_SELECTED)

    # Commit session state BEFORE sending the WhatsApp message.
    # The API call takes ~1-2s; without this early commit, the user can reply
    # before the transaction is committed and read stale START state.
    await db.commit()
    _log_action(sender, f"Sent service list ({len(services)} services)")

    sections = [
        {
            "title": "Our Services",
            "rows": [
                {
                    "id": str(svc.id),
                    "title": svc.name[:24],
                    "description": f"{svc.duration_minutes} min",
                }
                for svc in services
            ],
        }
    ]

    intro = f"Great, *{uname}*!" if uname else "Thank you for choosing *ORA Clinic*!"
    await wa_client.send_list_message(
        to=sender,
        body=f"{intro} Please select a service to book your appointment:",
        button_label="View Services",
        sections=sections,
    )


async def _handle_service_selection(
    sender: str,
    service_id_str: str,
    db: AsyncSession,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """Store selected service and send available time slots."""
    try:
        service_id = uuid.UUID(service_id_str)
    except (ValueError, AttributeError):
        logger.warning("Invalid service_id received: %r", service_id_str)
        await wa_client.send_text(sender, "Invalid selection. Please choose a service from the list below.")
        return

    service = await svc_repo.get_service_by_id(db, service_id)
    if service is None:
        await wa_client.send_text(sender, "That service is no longer available. Please select another service.")
        return

    user_session = await sess_repo.get_or_create_session(db, sender)
    active_campaign = await campaign_service.resolve_active_campaign(db, user_session)
    if active_campaign is not None and campaign_service.is_campaign_active(active_campaign):
        if not campaign_service.is_service_eligible(active_campaign, service_id):
            await wa_client.send_text(
                sender,
                "That service is not available under the current offer. Please choose one of the eligible services.",
            )
            return

    slots = await slot_repo.get_available_slots(db, service_id)
    if active_campaign is not None and campaign_service.is_campaign_active(active_campaign):
        slots = [
            slot for slot in slots
            if campaign_service.is_slot_eligible(active_campaign, slot.start_time)
        ]
    if not slots:
        # Keep session at SERVICE_SELECTED and re-show the service list
        # so user can pick a different service
        await wa_client.send_text(
            sender,
            f"Sorry, *{service.name}* has no available slots right now. Please choose another service.",
        )
        await _handle_greeting(sender, db, wa_client, uname)
        return

    await sess_repo.update_session(db, sender, SessionStep.SLOT_SELECTED, service_id=service_id)
    await db.commit()  # commit before sending — user may reply before we return
    _log_action(sender, f'Service selected: "{service.name}" — sent {len(slots)} slots')

    sections = [
        {
            "title": "Available Slots",
            "rows": [
                {
                    "id": str(slot.id),
                    "title": _to_ist(slot.start_time).strftime("%b %d, %I:%M %p"),
                    "description": f"Until {_to_ist(slot.end_time).strftime('%I:%M %p')}",
                }
                for slot in slots
            ],
        }
    ]

    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_list_message(
        to=sender,
        body=f"Great choice{name_part}! You selected *{service.name}* ({service.duration_minutes} min).\n\nChoose a time slot that works for you:",
        button_label="View Slots",
        sections=sections,
    )


async def _handle_slot_selection(
    sender: str,
    slot_id_str: str,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """Acquire a Redis lock on the slot and prompt for confirmation."""
    try:
        slot_id = uuid.UUID(slot_id_str)
    except (ValueError, AttributeError):
        logger.warning("Invalid slot_id received: %r", slot_id_str)
        await wa_client.send_text(sender, "Invalid selection. Please choose a slot from the list below.")
        return

    slot = await slot_repo.get_slot_by_id(db, slot_id)
    if slot is None:
        await wa_client.send_text(
            sender,
            "That slot is no longer available. Please choose another time.",
        )
        return

    # Check there is still at least one open provider slot at this start_time
    user_session = await sess_repo.get_or_create_session(db, sender)
    if user_session.selected_service_id is None:
        await wa_client.send_text(sender, "Session expired. Please send 'hi' to start over.")
        return
    available_check = await slot_repo.get_available_slots(db, user_session.selected_service_id, limit=50)
    still_available = any(s.start_time == slot.start_time for s in available_check)
    if not still_available:
        await wa_client.send_text(
            sender,
            "That slot is no longer available. Please choose another time.",
        )
        return

    # Acquire soft lock in Redis
    acquired = await session_svc.acquire_slot_lock(slot_id_str, sender)
    if not acquired:
        await wa_client.send_text(
            sender,
            "That slot is currently being reserved by another user. Please choose a different time.",
        )
        return

    # Update session to record the selected slot
    await sess_repo.update_session(db, sender, SessionStep.SLOT_SELECTED, slot_id=slot_id)

    time_display = _to_ist(slot.start_time).strftime("%A, %B %d at %I:%M %p")
    end_display = _to_ist(slot.end_time).strftime("%I:%M %p")

    _log_action(sender, f'Slot selected: {time_display} — sent confirmation prompt')

    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_button_message(
        to=sender,
        body=(
            f"Almost there{name_part}! Please confirm your appointment at *ORA Clinic*:\n\n"
            f"Date & Time: {time_display} – {end_display}\n\n"
            f"Tap *Confirm* to book or *Cancel* to choose a different slot."
        ),
        buttons=[
            {"id": f"confirm_{slot_id_str}", "title": "Confirm"},
            {"id": "cancel_booking", "title": "Cancel"},
        ],
    )


async def _handle_booking_confirmation(
    sender: str,
    slot_id_str: str,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """
    Finalize the booking with a DB transaction.

    Two-layer conflict protection:
    1. Redis lock (already acquired in _handle_slot_selection)
    2. SELECT FOR UPDATE NOWAIT — absolute DB-level guarantee
    """
    try:
        slot_id = uuid.UUID(slot_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Something went wrong. Please send 'hi' to start over.")
        return

    user_session = await sess_repo.get_or_create_session(db, sender)

    if user_session.selected_service_id is None:
        # Session is missing context — restart
        await sess_repo.reset_session(db, sender)
        await wa_client.send_text(sender, "Session expired. Please send 'hi' to start over.")
        return

    try:
        # Resolve the representative slot to get the start_time for this selection
        representative_slot = await slot_repo.get_slot_by_id(db, slot_id)
        if representative_slot is None:
            await session_svc.release_slot_lock(slot_id_str)
            await sess_repo.update_session(db, sender, SessionStep.SERVICE_SELECTED)
            await wa_client.send_text(
                sender,
                "Sorry, that slot is no longer available. Please choose a different time.",
            )
            return

        # Reserve one provider's slot for this service/time (least-loaded provider wins)
        reservation = await slot_repo.reserve_provider_slot(
            db,
            service_id=user_session.selected_service_id,
            start_time=representative_slot.start_time,
        )

        if reservation is None:
            # All providers for this service are occupied at this time
            await session_svc.release_slot_lock(slot_id_str)
            await sess_repo.update_session(db, sender, SessionStep.SERVICE_SELECTED)
            await wa_client.send_text(
                sender,
                "Sorry, that slot was just fully booked. "
                "Please choose a different time.",
            )
            return

        slot, assigned_provider_id = reservation

        customer, _ = await customer_repo.get_or_create_by_phone(db, sender)
        service = await svc_repo.get_service_by_id(db, user_session.selected_service_id)
        active_campaign = await campaign_service.resolve_active_campaign(db, user_session)

        booking_snapshot = campaign_service.build_booking_snapshot(user_session, active_campaign)
        service_cost = service.cost if service else None
        final_cost = service_cost

        if active_campaign is not None and user_session.active_journey_type.value == "campaign":
            if not campaign_service.is_campaign_active(active_campaign):
                await campaign_service.start_organic_journey(
                    db,
                    sender,
                    entry_point="campaign_expired",
                    entry_message_id=None,
                )
                await wa_client.send_text(
                    sender,
                    "That offer has expired. Send *hi* to start a standard booking.",
                )
                return
            if service and not campaign_service.is_service_eligible(active_campaign, service.id):
                await wa_client.send_text(
                    sender,
                    "This booking is not eligible for the selected campaign.",
                )
                return
            if not campaign_service.is_slot_eligible(active_campaign, slot.start_time):
                await wa_client.send_text(
                    sender,
                    "This time slot is not eligible for the selected campaign. Please choose another slot.",
                )
                return
            existing_count = await campaign_repo.count_customer_campaign_bookings(
                db,
                campaign_id=active_campaign.id,
                user_phone=sender,
            )
            campaign_service.ensure_booking_limit(active_campaign, existing_count=existing_count)
            if service_cost is not None:
                final_cost = campaign_service.calculate_final_cost(service_cost, active_campaign)

        # Create the appointment record with the auto-assigned provider
        appointment = await appt_repo.create_appointment(
            db,
            user_phone=sender,
            service_id=user_session.selected_service_id,
            slot_id=slot.id,
            provider_id=assigned_provider_id,
            customer_id=customer.id,
            campaign_id=booking_snapshot["campaign_id"],
            campaign_code_snapshot=booking_snapshot["campaign_code_snapshot"],
            campaign_name_snapshot=booking_snapshot["campaign_name_snapshot"],
            discount_type_snapshot=booking_snapshot["discount_type_snapshot"],
            discount_value_snapshot=booking_snapshot["discount_value_snapshot"],
            service_cost_snapshot=service_cost,
            final_cost_snapshot=final_cost,
        )
        
        # Write status history for the booking
        from app.services.appointment_crm_service import _write_status_history
        from app.models.appointment import AppointmentSource
        await _write_status_history(
            db,
            appointment_id=appointment.id,
            old_status=None,
            new_status="confirmed",
            changed_by_id=None,
            source=AppointmentSource.WHATSAPP,
            slot_start_time=slot.start_time,
        )

        # Release Redis lock (slot is now permanently booked in DB)
        await session_svc.release_slot_lock(slot_id_str)

        # Broadcast SSE event to CRM clients
        from app.api.v1.events import broadcast as sse_broadcast
        sse_broadcast("appointment_created", {"appointment_id": str(appointment.id)})

        # Fetch service name for the confirmation message
        service_name = service.name if service else "your service"

        time_display = _to_ist(slot.start_time).strftime("%A, %B %d at %I:%M %p")
        booking_ref = str(appointment.id).split("-")[0].upper()  # Short human-readable ID

        _log_action(sender, f'BOOKED: {service_name} on {time_display} (ref: {booking_ref})')

        name_part = f", *{uname}*" if uname else ""
        cost_lines = ""
        if service_cost is not None and final_cost is not None:
            cost_lines = f"Price: Rs {service_cost:.2f}\nFinal Price: Rs {final_cost:.2f}\n"
            if booking_snapshot["campaign_name_snapshot"]:
                cost_lines += f"Offer: {booking_snapshot['campaign_name_snapshot']}\n"
        await wa_client.send_text(
            sender,
            f"🎉 Your appointment at *ORA Clinic* is confirmed{name_part}!\n\n"
            f"Service: {service_name}\n"
            f"Date & Time: {time_display}\n"
            f"{cost_lines}"
            f"Booking Ref: {booking_ref}\n\n"
            f"Reply *my appointments* to manage your bookings, or *hi* to book another.",
        )

        # Collect name/email via Flow if we don't have them yet
        if not customer.name:
            await sess_repo.update_session(db, sender, SessionStep.AWAITING_NAME)
            await db.commit()
            await _send_details_flow(sender, wa_client)
        else:
            await sess_repo.update_session(db, sender, SessionStep.BOOKED)

    except (OperationalError, IntegrityError):
        # OperationalError: SELECT FOR UPDATE NOWAIT raised (concurrent lock)
        # IntegrityError: unique constraint on slot_id violated (slot already booked)
        logger.warning("Slot %s unavailable for user %s", slot_id, sender)
        await session_svc.release_slot_lock(slot_id_str)
        await sess_repo.update_session(db, sender, SessionStep.SERVICE_SELECTED)
        await db.rollback()
        await wa_client.send_text(
            sender,
            "Sorry, that slot is no longer available. Please send *hi* to choose a different time.",
        )
    except WhatsAppAPIError:
        # DB was updated but confirmation message failed — log for manual follow-up
        logger.exception(
            "Appointment created for %s but failed to send confirmation message", sender
        )


async def _send_details_flow(sender: str, wa_client: WhatsAppClient) -> None:
    """Send the WhatsApp Flow form to collect name and email.
    Falls back to a plain text prompt if no Flow ID is configured."""
    if settings.WHATSAPP_FLOW_ID:
        await wa_client.send_flow_message(
            to=sender,
            body="Just one last step — please fill in your details so we can keep you updated about your appointment.",
            button_label="Fill in details",
            flow_id=settings.WHATSAPP_FLOW_ID,
            flow_token=str(_uuid.uuid4()),
        )
    else:
        await wa_client.send_text(
            sender,
            "One quick thing — what's your name so we can personalise your experience?",
        )


async def _handle_update_name_prompt(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient, uname: str | None = None
) -> None:
    """Ask the user to type their new name."""
    await sess_repo.update_session(db, sender, SessionStep.UPDATING_NAME)
    await db.commit()
    current = f" (currently *{uname}*)" if uname else ""
    await wa_client.send_text(sender, f"What would you like to update your name to?{current}")


async def _handle_save_updated_name(
    sender: str, name: str, db: AsyncSession, wa_client: WhatsAppClient
) -> None:
    """Save the updated name and return to main menu."""
    name = name.title()
    customer, _ = await customer_repo.get_or_create_by_phone(db, sender)
    await customer_repo.update_customer(db, customer.id, name=name)
    await sess_repo.update_session(db, sender, SessionStep.BOOKED)
    await db.commit()
    await wa_client.send_text(sender, f"Done! Your name has been updated to *{name}*. Reply *hi* to go back to the menu.")


async def _handle_text_name(
    sender: str, name: str, db: AsyncSession, wa_client: WhatsAppClient
) -> None:
    """Fallback: collect name via plain text reply."""
    name = name.title()
    customer, _ = await customer_repo.get_or_create_by_phone(db, sender)
    await customer_repo.update_customer(db, customer.id, name=name)
    await sess_repo.update_session(db, sender, SessionStep.AWAITING_EMAIL)
    await db.commit()
    await wa_client.send_text(sender, f"Thanks, {name}! What's your email address? (Type *skip* to skip)")


async def _handle_text_email(
    sender: str, text: str, db: AsyncSession, wa_client: WhatsAppClient, uname: str | None = None
) -> None:
    """Fallback: collect email via plain text reply."""
    if text.lower() != "skip":
        customer, _ = await customer_repo.get_or_create_by_phone(db, sender)
        await customer_repo.update_customer(db, customer.id, email=text)
    await sess_repo.update_session(db, sender, SessionStep.BOOKED)
    await db.commit()
    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_text(
        sender,
        f"All set{name_part}! Reply *hi* to book another appointment or *my appointments* to manage your bookings.",
    )


async def _handle_flow_submission(
    sender: str, data: dict, db: AsyncSession, wa_client: WhatsAppClient
) -> None:
    """Handle submitted WhatsApp Flow form data (name + email)."""
    name = data.get("name", "").strip().title()
    email = data.get("email", "").strip()
    customer, _ = await customer_repo.get_or_create_by_phone(db, sender)
    updates = {}
    if name:
        updates["name"] = name
    if email:
        updates["email"] = email
    if updates:
        await customer_repo.update_customer(db, customer.id, **updates)
    await sess_repo.update_session(db, sender, SessionStep.BOOKED)
    await db.commit()
    await wa_client.send_text(
        sender,
        f"Thanks{', ' + name if name else ''}! 😊 We'll be in touch. Reply *hi* to book another or *my appointments* to manage your bookings.",
    )


async def _handle_cancel(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient, uname: str | None = None
) -> None:
    """User cancelled — reset session and send service list again."""
    await _handle_greeting(sender, db, wa_client, uname)


# ---------------------------------------------------------------------------
# Manage appointments handlers
# ---------------------------------------------------------------------------

async def _handle_manage_menu(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient, uname: str | None = None
) -> None:
    """Show the user's upcoming confirmed appointments as a list."""
    appointments = await appt_repo.get_upcoming_appointments(db, sender)

    if not appointments:
        name_part = f", *{uname}*" if uname else ""
        await wa_client.send_text(
            sender,
            f"You have no upcoming appointments at *ORA Clinic*{name_part}.\n\nSend *hi* to book one.",
        )
        return

    await sess_repo.update_session(db, sender, SessionStep.MANAGE_MENU)
    await db.commit()
    _log_action(sender, f"Sent appointments list ({len(appointments)} upcoming)")

    rows = []
    for appt in appointments:
        service_name = appt.service.name if appt.service else "Service"
        slot_display = (
            _to_ist(appt.slot.start_time).strftime("%b %d, %I:%M %p") if appt.slot else "—"
        )
        ref = str(appt.id).split("-")[0].upper()
        # Row title max 24 chars — truncate service name if needed
        title = service_name[:24]
        rows.append({
            "id": str(appt.id),
            "title": title,
            "description": f"{slot_display} · {ref}",
        })

    sections = [{"title": "Upcoming Appointments", "rows": rows}]

    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_list_message(
        to=sender,
        body=f"Here are your upcoming appointments at *ORA Clinic*{name_part}. Tap one to cancel or reschedule:",
        button_label="My Bookings",
        sections=sections,
    )


async def _handle_appointment_selection(
    sender: str,
    appointment_id_str: str,
    db: AsyncSession,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """User tapped an appointment — show cancel / reschedule / back buttons."""
    try:
        appointment_id = uuid.UUID(appointment_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Invalid selection. Please choose from the list below.")
        return

    appointment = await appt_repo.get_appointment_by_id(db, appointment_id)
    if appointment is None or appointment.status.value != "confirmed":
        await wa_client.send_text(
            sender,
            "That appointment is no longer active. Send *my appointments* to refresh the list.",
        )
        return

    service_name = appointment.service.name if appointment.service else "Service"
    time_display = (
        _to_ist(appointment.slot.start_time).strftime("%A, %B %d at %I:%M %p")
        if appointment.slot
        else "—"
    )
    end_display = (
        _to_ist(appointment.slot.end_time).strftime("%I:%M %p") if appointment.slot else ""
    )

    await sess_repo.update_session(
        db, sender, SessionStep.MANAGE_APPOINTMENT, appointment_id=appointment_id
    )
    await db.commit()
    _log_action(sender, f'Appointment selected: "{service_name}" on {time_display}')

    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_button_message(
        to=sender,
        body=(
            f"*{service_name}* at *ORA Clinic*\n"
            f"Date & Time: {time_display} – {end_display}\n\n"
            f"What would you like to do{name_part}?"
        ),
        buttons=[
            {"id": f"cancel_appt_{appointment_id_str}", "title": "Cancel"},
            {"id": f"reschedule_{appointment_id_str}", "title": "Reschedule"},
            {"id": "back_to_menu", "title": "Back"},
        ],
    )


async def _handle_appointment_cancel(
    sender: str,
    appointment_id_str: str,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """Cancel the selected appointment and free the slot."""
    try:
        appointment_id = uuid.UUID(appointment_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Something went wrong. Send *my appointments* to try again.")
        return

    appointment = await appt_repo.cancel_appointment(db, appointment_id)

    if appointment is None:
        await wa_client.send_text(
            sender,
            "That appointment could not be cancelled (it may already be cancelled). "
            "Send *my appointments* to see your current bookings at *ORA Clinic*.",
        )
        return
    
    service_name = appointment.service.name if appointment.service else "your appointment"
    slot = appointment.slot

    # Write status history for cancellation
    from app.services.appointment_crm_service import _write_status_history
    from app.models.appointment import AppointmentSource
    await _write_status_history(
        db,
        appointment_id=appointment_id,
        old_status="confirmed",
        new_status="cancelled",
        changed_by_id=None,
        source=AppointmentSource.WHATSAPP,
        slot_start_time=slot.start_time if slot else None,
    )
    # Broadcast SSE event to CRM clients
    from app.api.v1.events import broadcast as sse_broadcast
    sse_broadcast("appointment_updated", {"appointment_id": str(appointment_id)})

    time_display = _to_ist(slot.start_time).strftime("%A, %B %d at %I:%M %p") if slot else "—"

    # Release any Redis lock for that slot (in case it was somehow still held)
    if slot:
        await session_svc.release_slot_lock(str(slot.id))

    await sess_repo.update_session(db, sender, SessionStep.BOOKED)
    _log_action(sender, f'CANCELLED: "{service_name}" on {time_display}')

    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_text(
        sender,
        f"Your appointment at *ORA Clinic* has been cancelled{name_part}.\n\n"
        f"Service: {service_name}\n"
        f"Date & Time: {time_display}\n\n"
        f"Send *hi* to book a new appointment.",
    )


async def _handle_reschedule_start(
    sender: str,
    appointment_id_str: str,
    db: AsyncSession,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """Begin reschedule: load the appointment's service and show available slots."""
    try:
        appointment_id = uuid.UUID(appointment_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Something went wrong. Send *my appointments* to try again.")
        return

    appointment = await appt_repo.get_appointment_by_id(db, appointment_id)
    if appointment is None or appointment.status.value != "confirmed":
        await wa_client.send_text(
            sender,
            "That appointment is no longer active. Send *my appointments* to refresh.",
        )
        return

    service = appointment.service
    if service is None:
        await wa_client.send_text(sender, "Could not load service details. Please try again.")
        return

    slots = await slot_repo.get_available_slots(db, service.id)
    if not slots:
        await wa_client.send_text(
            sender,
            f"No available slots for *{service.name}* at *ORA Clinic* right now. "
            "Please try again later.",
        )
        return

    # Store appointment_id and service_id in session for the confirmation step
    await sess_repo.update_session(
        db,
        sender,
        SessionStep.RESCHEDULE_SLOT,
        service_id=service.id,
        appointment_id=appointment_id,
    )
    await db.commit()
    _log_action(sender, f'Reschedule started for "{service.name}" — sent {len(slots)} slots')

    sections = [
        {
            "title": "Available Slots",
            "rows": [
                {
                    "id": str(slot.id),
                    "title": _to_ist(slot.start_time).strftime("%b %d, %I:%M %p"),
                    "description": f"Until {_to_ist(slot.end_time).strftime('%I:%M %p')}",
                }
                for slot in slots
            ],
        }
    ]

    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_list_message(
        to=sender,
        body=f"Rescheduling your appointment at *ORA Clinic*{name_part}.\n\nChoose a new time slot for *{service.name}*:",
        button_label="View Slots",
        sections=sections,
    )


async def _handle_reschedule_slot_selection(
    sender: str,
    slot_id_str: str,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """Acquire Redis lock on the new slot and show confirm/back buttons."""
    try:
        slot_id = uuid.UUID(slot_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Invalid selection. Please choose a slot from the list below.")
        return

    slot = await slot_repo.get_slot_by_id(db, slot_id)
    if slot is None:
        await wa_client.send_text(sender, "That slot is no longer available. Please choose another time.")
        return

    # Check there is still at least one open provider slot at this start_time
    user_session = await sess_repo.get_or_create_session(db, sender)
    if user_session.selected_service_id is None:
        await wa_client.send_text(sender, "Session expired. Send *my appointments* to try again.")
        return
    available_check = await slot_repo.get_available_slots(db, user_session.selected_service_id, limit=50)
    still_available = any(s.start_time == slot.start_time for s in available_check)
    if not still_available:
        await wa_client.send_text(sender, "That slot is no longer available. Please choose another time.")
        return

    acquired = await session_svc.acquire_slot_lock(slot_id_str, sender)
    if not acquired:
        await wa_client.send_text(
            sender,
            "That slot is being reserved by another user. Please choose a different time.",
        )
        return

    await sess_repo.update_session(db, sender, SessionStep.RESCHEDULE_SLOT, slot_id=slot_id)

    time_display = _to_ist(slot.start_time).strftime("%A, %B %d at %I:%M %p")
    end_display = _to_ist(slot.end_time).strftime("%I:%M %p")
    _log_action(sender, f'New slot selected: {time_display} — sent reschedule confirmation')

    name_part = f", *{uname}*" if uname else ""
    await wa_client.send_button_message(
        to=sender,
        body=(
            f"New time slot at *ORA Clinic*{name_part}:\n\n"
            f"Date & Time: {time_display} – {end_display}\n\n"
            f"Tap *Confirm* to reschedule or *Back* to choose a different slot."
        ),
        buttons=[
            {"id": f"confirm_reschedule_{slot_id_str}", "title": "Confirm"},
            {"id": "cancel_reschedule", "title": "Back"},
        ],
    )


async def _handle_reschedule_confirmation(
    sender: str,
    new_slot_id_str: str,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
    uname: str | None = None,
) -> None:
    """
    Finalize reschedule:
    1. Book new slot (SELECT FOR UPDATE NOWAIT)
    2. Update existing appointment with new slot_id
    3. Write status history
    """
    try:
        new_slot_id = uuid.UUID(new_slot_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Something went wrong. Send *my appointments* to try again.")
        return

    user_session = await sess_repo.get_or_create_session(db, sender)

    if user_session.selected_appointment_id is None or user_session.selected_service_id is None:
        await sess_repo.reset_session(db, sender)
        await wa_client.send_text(sender, "Session expired. Send *my appointments* to try again.")
        return

    appointment_id = user_session.selected_appointment_id

    try:
        # Resolve the representative slot to get start_time
        representative_new_slot = await slot_repo.get_slot_by_id(db, new_slot_id)
        if representative_new_slot is None:
            await session_svc.release_slot_lock(new_slot_id_str)
            await wa_client.send_text(sender, "Sorry, that slot is no longer available. Please choose a different time.")
            return

        # Get old appointment first so we know the old slot
        old_appointment = await appt_repo.get_appointment_crm_by_id(db, appointment_id)
        if not old_appointment:
            await session_svc.release_slot_lock(new_slot_id_str)
            await wa_client.send_text(sender, "Appointment not found.")
            return

        old_slot_id = old_appointment.slot_id

        # Reserve a provider slot for the new time (least-loaded)
        reservation = await slot_repo.reserve_provider_slot(
            db,
            service_id=user_session.selected_service_id,
            start_time=representative_new_slot.start_time,
        )

        if reservation is None:
            await session_svc.release_slot_lock(new_slot_id_str)
            await wa_client.send_text(
                sender,
                "Sorry, that slot was just fully booked. Please choose a different time.",
            )
            return

        new_slot, new_provider_id = reservation

        # Update the existing appointment with new slot and provider
        updated_appointment = await appt_repo.update_appointment_fields(
            db,
            appointment_id,
            slot_id=new_slot.id,
            provider_id=new_provider_id,
            rescheduled_from_slot_id=old_slot_id,
            status="confirmed",
        )

        # Write status history for the reschedule
        from app.services.appointment_crm_service import _write_status_history
        from app.models.appointment import AppointmentSource
        old_slot_start = old_appointment.slot.start_time if old_appointment.slot else None
        await _write_status_history(
            db,
            appointment_id=appointment_id,
            old_status="confirmed",
            new_status="confirmed",  # Status remains confirmed, just slot changed
            changed_by_id=None,
            reason="Rescheduled to new slot via WhatsApp",
            source=AppointmentSource.WHATSAPP,
            reschedule_source=AppointmentSource.WHATSAPP,
            slot_start_time=new_slot.start_time,
            old_slot_start_time=old_slot_start,
        )

        # Free the old provider slot so it becomes available again
        if old_slot_id:
            await slot_repo.release_provider_slot(db, old_slot_id)
        await session_svc.release_slot_lock(str(old_slot_id))

        # Broadcast SSE event to CRM clients
        from app.api.v1.events import broadcast as sse_broadcast
        sse_broadcast("appointment_updated", {"appointment_id": str(appointment_id)})

        await sess_repo.update_session(db, sender, SessionStep.BOOKED)
        await session_svc.release_slot_lock(new_slot_id_str)

        service = await svc_repo.get_service_by_id(db, user_session.selected_service_id)
        service_name = service.name if service else "your service"
        time_display = _to_ist(new_slot.start_time).strftime("%A, %B %d at %I:%M %p")
        booking_ref = str(appointment_id).split("-")[0].upper()

        _log_action(sender, f'RESCHEDULED: {service_name} → {time_display} (ref: {booking_ref})')

        name_part = f", *{uname}*" if uname else ""
        await wa_client.send_text(
            sender,
            f"Your appointment at *ORA Clinic* has been rescheduled{name_part}!\n\n"
            f"Service: {service_name}\n"
            f"New Date & Time: {time_display}\n"
            f"Booking Ref: {booking_ref}\n\n"
            f"Reply *my appointments* to manage your bookings.",
        )

    except (OperationalError, IntegrityError):
        logger.warning("New slot %s unavailable for user %s", new_slot_id, sender)
        await session_svc.release_slot_lock(new_slot_id_str)
        await db.rollback()
        await wa_client.send_text(
            sender,
            "Sorry, that slot is no longer available. Please send *my appointments* to try again.",
        )
    except WhatsAppAPIError:
        logger.exception(
            "Reschedule completed for %s but failed to send confirmation message", sender
        )
