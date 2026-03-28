"""
Pure stateless functions for parsing Meta WhatsApp Cloud API webhook payloads.

Meta webhook payload structure:
{
    "object": "whatsapp_business_account",
    "entry": [{
        "changes": [{
            "value": {
                "messages": [{ ... }],    # only present for inbound messages
                "statuses": [{ ... }]     # only present for delivery/read receipts
            }
        }]
    }]
}
"""
import enum


class MessageType(str, enum.Enum):
    TEXT = "text"
    LIST_REPLY = "list_reply"
    BUTTON_REPLY = "button_reply"
    FLOW_REPLY = "flow_reply"
    UNKNOWN = "unknown"


def extract_message(payload: dict) -> dict | None:
    """
    Extract the first message object from the webhook payload.
    Returns None if the payload contains no messages (e.g., status updates).
    """
    try:
        return payload["entry"][0]["changes"][0]["value"]["messages"][0]
    except (KeyError, IndexError, TypeError):
        return None


def extract_sender_phone(payload: dict) -> str | None:
    """Extract the sender's phone number from the webhook payload."""
    try:
        return payload["entry"][0]["changes"][0]["value"]["messages"][0]["from"]
    except (KeyError, IndexError, TypeError):
        return None


def extract_whatsapp_profile_name(payload: dict) -> str | None:
    """Extract the sender's WhatsApp profile name from the webhook payload."""
    try:
        return payload["entry"][0]["changes"][0]["value"]["contacts"][0]["profile"]["name"]
    except (KeyError, IndexError, TypeError):
        return None


def get_message_type(message: dict) -> MessageType:
    """Classify a message dict into one of the supported MessageType values."""
    msg_type = message.get("type")

    if msg_type == "text":
        return MessageType.TEXT

    if msg_type == "interactive":
        interactive_type = message.get("interactive", {}).get("type")
        if interactive_type == "list_reply":
            return MessageType.LIST_REPLY
        if interactive_type == "button_reply":
            return MessageType.BUTTON_REPLY
        if interactive_type == "nfm_reply":
            return MessageType.FLOW_REPLY

    return MessageType.UNKNOWN


def get_text_body(message: dict) -> str:
    """Return the text body of a text message, stripped and lowercased."""
    return message.get("text", {}).get("body", "").strip().lower()


def get_list_reply_id(message: dict) -> str:
    """Return the selected row ID from an interactive list reply."""
    return message.get("interactive", {}).get("list_reply", {}).get("id", "")


def get_button_reply_id(message: dict) -> str:
    """Return the button ID from an interactive button reply."""
    return message.get("interactive", {}).get("button_reply", {}).get("id", "")


def get_message_id(message: dict) -> str:
    """Return the unique message ID (used for idempotency deduplication)."""
    return message.get("id", "")


def get_flow_reply_data(message: dict) -> dict:
    """Return the submitted payload from a WhatsApp Flow reply (nfm_reply)."""
    import json
    raw = message.get("interactive", {}).get("nfm_reply", {}).get("response_json", "{}")
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return {}


# Greetings that trigger the booking flow from any state
GREETING_KEYWORDS = {"hi", "hello", "hey", "start", "book", "appointment"}

# Keywords that trigger the manage-appointments flow
MANAGE_KEYWORDS = {"my appointments", "manage", "my bookings", "view appointments", "appointments"}


def is_greeting(text: str) -> bool:
    """Return True if the text is a greeting that should restart the booking flow."""
    return text.strip().lower() in GREETING_KEYWORDS


def is_manage_request(text: str) -> bool:
    """Return True if the text should trigger the manage-appointments flow."""
    return text.strip().lower() in MANAGE_KEYWORDS
