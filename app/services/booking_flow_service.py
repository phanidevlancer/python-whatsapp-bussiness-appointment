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

from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.whatsapp_client import WhatsAppClient, WhatsAppAPIError
from app.models.user_session import SessionStep
from app.repositories import (
    appointment_repository as appt_repo,
    service_repository as svc_repo,
    session_repository as sess_repo,
    slot_repository as slot_repo,
)
from app.services.session_service import SessionService
from app.utils.whatsapp_parser import (
    MessageType,
    extract_message,
    extract_sender_phone,
    get_button_reply_id,
    get_list_reply_id,
    get_message_id,
    get_message_type,
    get_text_body,
    is_greeting,
    is_manage_request,
)

logger = logging.getLogger(__name__)


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
        import traceback
        print(f"BOOKING FLOW ERROR: {e}", flush=True)
        traceback.print_exc()
        logger.exception("Unhandled error in booking flow")


async def _process_message(
    payload: dict,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
) -> None:
    logger.info("RAW PAYLOAD: %s", payload)

    message = extract_message(payload)
    if message is None:
        logger.info("No message in payload (status update), skipping")
        return

    sender = extract_sender_phone(payload)
    if not sender:
        logger.warning("Could not extract sender phone from payload")
        return

    message_id = get_message_id(message)
    msg_type = get_message_type(message)
    logger.info("Extracted: sender=%s message_id=%s msg_type=%s message=%s", sender, message_id, msg_type, message)

    # --- Idempotency: skip already-processed messages ---
    if message_id and await session_svc.is_duplicate_message(message_id):
        logger.info("Skipping duplicate message id=%s", message_id)
        return

    if message_id:
        await session_svc.mark_message_processed(message_id)

    # --- Load or create session ---
    user_session = await sess_repo.get_or_create_session(db, sender)
    logger.info("Session loaded for %s: step=%s", sender, user_session.current_step)
    text_body = get_text_body(message)
    logger.info(
        "Message from %s | type=%s | step=%s | text=%r",
        sender, msg_type, user_session.current_step, text_body
    )

    # --- Manage flow keyword — works from any state ---
    if msg_type == MessageType.TEXT and is_manage_request(text_body):
        logger.info("Manage request detected, showing appointments to %s", sender)
        await _handle_manage_menu(sender, db, wa_client)
        return

    # --- Greeting always restarts the booking flow regardless of current state ---
    if msg_type == MessageType.TEXT and is_greeting(text_body):
        logger.info("Greeting detected, sending service list to %s", sender)
        await _handle_greeting(sender, db, wa_client)
        return

    # --- Route by state ---
    step = user_session.current_step

    if step in (SessionStep.START, SessionStep.BOOKED):
        await wa_client.send_text(
            sender,
            "Send *hi* to book an appointment, or *my appointments* to view and manage your bookings.",
        )

    elif step == SessionStep.SERVICE_SELECTED:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_service_selection(sender, get_list_reply_id(message), db, wa_client)
        else:
            await wa_client.send_text(sender, "Please select a service from the list.")

    elif step == SessionStep.SLOT_SELECTED:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_slot_selection(sender, get_list_reply_id(message), db, session_svc, wa_client)
        elif msg_type == MessageType.BUTTON_REPLY:
            button_id = get_button_reply_id(message)
            if button_id.startswith("confirm_"):
                slot_id_str = button_id[len("confirm_"):]
                await _handle_booking_confirmation(sender, slot_id_str, db, session_svc, wa_client)
            elif button_id == "cancel_booking":
                await _handle_cancel(sender, db, wa_client)
            else:
                await wa_client.send_text(sender, "Please use the buttons to confirm or cancel.")
        else:
            await wa_client.send_text(sender, "Please select a time slot from the list.")

    elif step == SessionStep.MANAGE_MENU:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_appointment_selection(sender, get_list_reply_id(message), db, wa_client)
        else:
            await wa_client.send_text(sender, "Please select an appointment from the list.")

    elif step == SessionStep.MANAGE_APPOINTMENT:
        if msg_type == MessageType.BUTTON_REPLY:
            button_id = get_button_reply_id(message)
            if button_id.startswith("cancel_appt_"):
                appt_id_str = button_id[len("cancel_appt_"):]
                await _handle_appointment_cancel(sender, appt_id_str, db, session_svc, wa_client)
            elif button_id.startswith("reschedule_"):
                appt_id_str = button_id[len("reschedule_"):]
                await _handle_reschedule_start(sender, appt_id_str, db, wa_client)
            elif button_id == "back_to_menu":
                await _handle_manage_menu(sender, db, wa_client)
            else:
                await wa_client.send_text(sender, "Please use the buttons to choose an action.")
        else:
            await wa_client.send_text(sender, "Please use the buttons to choose an action.")

    elif step == SessionStep.RESCHEDULE_SLOT:
        if msg_type == MessageType.LIST_REPLY:
            await _handle_reschedule_slot_selection(sender, get_list_reply_id(message), db, session_svc, wa_client)
        elif msg_type == MessageType.BUTTON_REPLY:
            button_id = get_button_reply_id(message)
            if button_id.startswith("confirm_reschedule_"):
                slot_id_str = button_id[len("confirm_reschedule_"):]
                await _handle_reschedule_confirmation(sender, slot_id_str, db, session_svc, wa_client)
            elif button_id == "cancel_reschedule":
                await _handle_manage_menu(sender, db, wa_client)
            else:
                await wa_client.send_text(sender, "Please use the buttons to confirm or go back.")
        else:
            await wa_client.send_text(sender, "Please select a new time slot from the list.")


# ---------------------------------------------------------------------------
# Booking step handlers
# ---------------------------------------------------------------------------

async def _handle_greeting(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient
) -> None:
    """Reset session and send the service selection list."""
    logger.info("_handle_greeting called for %s", sender)
    services = await svc_repo.get_active_services(db)
    logger.info("Found %d services for %s", len(services), sender)

    if not services:
        await wa_client.send_text(
            sender,
            "Sorry, there are no services available right now. Please try again later.",
        )
        return

    await sess_repo.update_session(db, sender, SessionStep.SERVICE_SELECTED)

    # Commit session state BEFORE sending the WhatsApp message.
    # The API call takes ~1-2s; without this early commit, the user can reply
    # before the transaction is committed and read stale START state.
    await db.commit()
    logger.info("Session committed as SERVICE_SELECTED for %s", sender)

    sections = [
        {
            "title": "Our Services",
            "rows": [
                {
                    "id": str(svc.id),
                    "title": svc.name,
                    "description": f"{svc.duration_minutes} min"
                    + (f" — {svc.description}" if svc.description else ""),
                }
                for svc in services
            ],
        }
    ]

    await wa_client.send_list_message(
        to=sender,
        body="Welcome! Please select a service to book an appointment:",
        button_label="View Services",
        sections=sections,
    )
    logger.info("_handle_greeting completed for %s", sender)


async def _handle_service_selection(
    sender: str,
    service_id_str: str,
    db: AsyncSession,
    wa_client: WhatsAppClient,
) -> None:
    """Store selected service and send available time slots."""
    try:
        service_id = uuid.UUID(service_id_str)
    except (ValueError, AttributeError):
        logger.warning("Invalid service_id received: %r", service_id_str)
        await wa_client.send_text(sender, "Invalid selection. Please choose a service from the list.")
        return

    service = await svc_repo.get_service_by_id(db, service_id)
    if service is None:
        await wa_client.send_text(sender, "That service is no longer available. Please try again.")
        return

    slots = await slot_repo.get_available_slots(db, service_id)
    if not slots:
        await wa_client.send_text(
            sender,
            f"No available slots for *{service.name}* right now. "
            "Please try again later or choose a different service.",
        )
        return

    await sess_repo.update_session(db, sender, SessionStep.SLOT_SELECTED, service_id=service_id)
    await db.commit()  # commit before sending — user may reply before we return

    sections = [
        {
            "title": "Available Slots",
            "rows": [
                {
                    "id": str(slot.id),
                    "title": slot.start_time.strftime("%b %d, %I:%M %p"),
                    "description": f"Until {slot.end_time.strftime('%I:%M %p')}",
                }
                for slot in slots
            ],
        }
    ]

    await wa_client.send_list_message(
        to=sender,
        body=f"You selected *{service.name}* ({service.duration_minutes} min).\n\nChoose a time slot:",
        button_label="View Slots",
        sections=sections,
    )


async def _handle_slot_selection(
    sender: str,
    slot_id_str: str,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
) -> None:
    """Acquire a Redis lock on the slot and prompt for confirmation."""
    try:
        slot_id = uuid.UUID(slot_id_str)
    except (ValueError, AttributeError):
        logger.warning("Invalid slot_id received: %r", slot_id_str)
        await wa_client.send_text(sender, "Invalid selection. Please choose a slot from the list.")
        return

    slot = await slot_repo.get_slot_by_id(db, slot_id)
    if slot is None or slot.is_booked:
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

    time_display = slot.start_time.strftime("%A, %B %d at %I:%M %p")
    end_display = slot.end_time.strftime("%I:%M %p")

    await wa_client.send_button_message(
        to=sender,
        body=(
            f"Please confirm your appointment:\n\n"
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
        await wa_client.send_text(sender, "Something went wrong. Please start over by sending 'hi'.")
        return

    user_session = await sess_repo.get_or_create_session(db, sender)

    if user_session.selected_service_id is None:
        # Session is missing context — restart
        await sess_repo.reset_session(db, sender)
        await wa_client.send_text(sender, "Session expired. Please send 'hi' to start over.")
        return

    try:
        # Attempt to lock the slot row in the DB (raises OperationalError if taken)
        slot = await slot_repo.mark_slot_booked(db, slot_id)

        if slot is None:
            # Slot already booked (another transaction completed first)
            await session_svc.release_slot_lock(slot_id_str)
            await sess_repo.update_session(db, sender, SessionStep.SERVICE_SELECTED)
            await wa_client.send_text(
                sender,
                "Sorry, that slot was just booked by someone else. "
                "Please choose a different time.",
            )
            return

        # Create the appointment record
        appointment = await appt_repo.create_appointment(
            db,
            user_phone=sender,
            service_id=user_session.selected_service_id,
            slot_id=slot_id,
        )

        # Advance session to BOOKED
        await sess_repo.update_session(db, sender, SessionStep.BOOKED)

        # Release Redis lock (slot is now permanently booked in DB)
        await session_svc.release_slot_lock(slot_id_str)

        # Fetch service name for the confirmation message
        service = await svc_repo.get_service_by_id(db, user_session.selected_service_id)
        service_name = service.name if service else "your service"

        time_display = slot.start_time.strftime("%A, %B %d at %I:%M %p")
        booking_ref = str(appointment.id).split("-")[0].upper()  # Short human-readable ID

        await wa_client.send_text(
            sender,
            f"Your appointment is confirmed!\n\n"
            f"Service: {service_name}\n"
            f"Date & Time: {time_display}\n"
            f"Booking Ref: {booking_ref}\n\n"
            f"Reply *my appointments* to manage your bookings, or *hi* to book another.",
        )

    except OperationalError:
        # SELECT FOR UPDATE NOWAIT raised — concurrent booking in progress
        logger.warning("Slot %s locked by concurrent transaction for user %s", slot_id, sender)
        await session_svc.release_slot_lock(slot_id_str)
        await sess_repo.update_session(db, sender, SessionStep.SERVICE_SELECTED)
        await wa_client.send_text(
            sender,
            "That slot was just taken. Please choose a different time.",
        )
    except WhatsAppAPIError:
        # DB was updated but confirmation message failed — log for manual follow-up
        logger.exception(
            "Appointment created for %s but failed to send confirmation message", sender
        )


async def _handle_cancel(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient
) -> None:
    """User cancelled — reset session and send service list again."""
    await _handle_greeting(sender, db, wa_client)


# ---------------------------------------------------------------------------
# Manage appointments handlers
# ---------------------------------------------------------------------------

async def _handle_manage_menu(
    sender: str, db: AsyncSession, wa_client: WhatsAppClient
) -> None:
    """Show the user's upcoming confirmed appointments as a list."""
    appointments = await appt_repo.get_upcoming_appointments(db, sender)

    if not appointments:
        await wa_client.send_text(
            sender,
            "You have no upcoming appointments.\n\nSend *hi* to book one.",
        )
        return

    await sess_repo.update_session(db, sender, SessionStep.MANAGE_MENU)
    await db.commit()

    rows = []
    for appt in appointments:
        service_name = appt.service.name if appt.service else "Service"
        slot_display = (
            appt.slot.start_time.strftime("%b %d, %I:%M %p") if appt.slot else "—"
        )
        ref = str(appt.id).split("-")[0].upper()
        rows.append({
            "id": str(appt.id),
            "title": f"{service_name} — {slot_display}",
            "description": f"Ref: {ref}",
        })

    sections = [{"title": "Upcoming Appointments", "rows": rows}]

    await wa_client.send_list_message(
        to=sender,
        body="Here are your upcoming appointments. Tap one to cancel or reschedule:",
        button_label="My Bookings",
        sections=sections,
    )


async def _handle_appointment_selection(
    sender: str,
    appointment_id_str: str,
    db: AsyncSession,
    wa_client: WhatsAppClient,
) -> None:
    """User tapped an appointment — show cancel / reschedule / back buttons."""
    try:
        appointment_id = uuid.UUID(appointment_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Invalid selection. Please choose from the list.")
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
        appointment.slot.start_time.strftime("%A, %B %d at %I:%M %p")
        if appointment.slot
        else "—"
    )
    end_display = (
        appointment.slot.end_time.strftime("%I:%M %p") if appointment.slot else ""
    )

    await sess_repo.update_session(
        db, sender, SessionStep.MANAGE_APPOINTMENT, appointment_id=appointment_id
    )
    await db.commit()

    await wa_client.send_button_message(
        to=sender,
        body=(
            f"*{service_name}*\n"
            f"Date & Time: {time_display} – {end_display}\n\n"
            f"What would you like to do?"
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
            "Send *my appointments* to see your current bookings.",
        )
        return

    service_name = appointment.service.name if appointment.service else "your appointment"
    slot = appointment.slot
    time_display = slot.start_time.strftime("%A, %B %d at %I:%M %p") if slot else "—"

    # Release any Redis lock for that slot (in case it was somehow still held)
    if slot:
        await session_svc.release_slot_lock(str(slot.id))

    await sess_repo.update_session(db, sender, SessionStep.BOOKED)

    await wa_client.send_text(
        sender,
        f"Your appointment has been cancelled.\n\n"
        f"Service: {service_name}\n"
        f"Date & Time: {time_display}\n\n"
        f"Send *hi* to book a new appointment.",
    )


async def _handle_reschedule_start(
    sender: str,
    appointment_id_str: str,
    db: AsyncSession,
    wa_client: WhatsAppClient,
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
            f"No available slots for *{service.name}* right now. "
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

    sections = [
        {
            "title": "Available Slots",
            "rows": [
                {
                    "id": str(slot.id),
                    "title": slot.start_time.strftime("%b %d, %I:%M %p"),
                    "description": f"Until {slot.end_time.strftime('%I:%M %p')}",
                }
                for slot in slots
            ],
        }
    ]

    await wa_client.send_list_message(
        to=sender,
        body=f"Rescheduling *{service.name}*.\n\nChoose a new time slot:",
        button_label="View Slots",
        sections=sections,
    )


async def _handle_reschedule_slot_selection(
    sender: str,
    slot_id_str: str,
    db: AsyncSession,
    session_svc: SessionService,
    wa_client: WhatsAppClient,
) -> None:
    """Acquire Redis lock on the new slot and show confirm/back buttons."""
    try:
        slot_id = uuid.UUID(slot_id_str)
    except (ValueError, AttributeError):
        await wa_client.send_text(sender, "Invalid selection. Please choose a slot from the list.")
        return

    slot = await slot_repo.get_slot_by_id(db, slot_id)
    if slot is None or slot.is_booked:
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

    time_display = slot.start_time.strftime("%A, %B %d at %I:%M %p")
    end_display = slot.end_time.strftime("%I:%M %p")

    await wa_client.send_button_message(
        to=sender,
        body=(
            f"New time slot:\n\n"
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
) -> None:
    """
    Finalize reschedule:
    1. Cancel old appointment and free old slot
    2. Book new slot (SELECT FOR UPDATE NOWAIT)
    3. Create new appointment
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

    old_appointment_id = user_session.selected_appointment_id

    try:
        # Book the new slot first (raises OperationalError if taken)
        new_slot = await slot_repo.mark_slot_booked(db, new_slot_id)

        if new_slot is None:
            await session_svc.release_slot_lock(new_slot_id_str)
            await wa_client.send_text(
                sender,
                "Sorry, that slot was just taken. Please choose a different time.",
            )
            return

        # Cancel the old appointment (also frees old slot)
        old_appointment = await appt_repo.cancel_appointment(db, old_appointment_id)

        # Create the new appointment
        new_appointment = await appt_repo.create_appointment(
            db,
            user_phone=sender,
            service_id=user_session.selected_service_id,
            slot_id=new_slot_id,
        )

        await sess_repo.update_session(db, sender, SessionStep.BOOKED)
        await session_svc.release_slot_lock(new_slot_id_str)

        service = await svc_repo.get_service_by_id(db, user_session.selected_service_id)
        service_name = service.name if service else "your service"
        time_display = new_slot.start_time.strftime("%A, %B %d at %I:%M %p")
        booking_ref = str(new_appointment.id).split("-")[0].upper()

        await wa_client.send_text(
            sender,
            f"Your appointment has been rescheduled!\n\n"
            f"Service: {service_name}\n"
            f"New Date & Time: {time_display}\n"
            f"Booking Ref: {booking_ref}\n\n"
            f"Reply *my appointments* to manage your bookings.",
        )

    except OperationalError:
        logger.warning("New slot %s locked by concurrent transaction for user %s", new_slot_id, sender)
        await session_svc.release_slot_lock(new_slot_id_str)
        await wa_client.send_text(
            sender,
            "That slot was just taken. Please choose a different time.",
        )
    except WhatsAppAPIError:
        logger.exception(
            "Reschedule completed for %s but failed to send confirmation message", sender
        )
