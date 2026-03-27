import logging

import httpx

logger = logging.getLogger(__name__)

# WhatsApp Cloud API base URL (v18.0 — update if Meta releases a newer stable version)
_GRAPH_API_BASE = "https://graph.facebook.com/v18.0"


class WhatsAppAPIError(Exception):
    """Raised when the WhatsApp Cloud API returns a non-2xx response."""

    def __init__(self, status_code: int, body: str) -> None:
        self.status_code = status_code
        self.body = body
        super().__init__(f"WhatsApp API error {status_code}: {body}")


class WhatsAppClient:
    """
    Async client for the Meta WhatsApp Cloud API.

    Wraps httpx.AsyncClient with a persistent connection pool.
    One instance is created at app startup and stored in app.state.
    """

    def __init__(self, token: str, phone_number_id: str) -> None:
        self._url = f"{_GRAPH_API_BASE}/{phone_number_id}/messages"
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=10.0)

    async def send_text(self, to: str, body: str) -> dict:
        """Send a plain text message."""
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body},
        }
        return await self._post(payload)

    async def send_list_message(
        self,
        to: str,
        body: str,
        button_label: str,
        sections: list[dict],
    ) -> dict:
        """
        Send an interactive list message (e.g., service or slot selection).

        sections format:
        [
            {
                "title": "Section Title",
                "rows": [
                    {"id": "unique_id", "title": "Row Title", "description": "Optional description"}
                ]
            }
        ]
        WhatsApp allows max 10 rows per section.
        """
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body},
                "action": {
                    "button": button_label,
                    "sections": sections,
                },
            },
        }
        return await self._post(payload)

    async def send_button_message(
        self,
        to: str,
        body: str,
        buttons: list[dict],
    ) -> dict:
        """
        Send an interactive button message (e.g., confirm/cancel).

        buttons format:
        [{"id": "button_id", "title": "Button Label"}]
        WhatsApp allows max 3 buttons.
        """
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {
                    "buttons": [
                        {
                            "type": "reply",
                            "reply": {"id": b["id"], "title": b["title"]},
                        }
                        for b in buttons
                    ]
                },
            },
        }
        return await self._post(payload)

    async def send_flow_message(
        self,
        to: str,
        body: str,
        button_label: str,
        flow_id: str,
        flow_token: str = "unused",
        screen: str = "COLLECT_INFO",
    ) -> dict:
        """
        Send a WhatsApp Flow message that opens an in-chat form.

        flow_id: the Flow ID from Meta Business Manager.
        flow_token: unique per-message token (used for replay protection); pass a UUID.
        screen: the opening screen ID defined in your Flow JSON.
        """
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "flow",
                "body": {"text": body},
                "action": {
                    "name": "flow",
                    "parameters": {
                        "flow_message_version": "3",
                        "flow_token": flow_token,
                        "flow_id": flow_id,
                        "flow_cta": button_label,
                        "flow_action": "navigate",
                        "flow_action_payload": {
                            "screen": screen,
                        },
                    },
                },
            },
        }
        return await self._post(payload)

    async def _post(self, payload: dict) -> dict:
        """Internal helper: POST to the messages endpoint with error handling."""
        try:
            response = await self._client.post(
                self._url, headers=self._headers, json=payload
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(
                "WhatsApp API HTTP error: status=%s body=%s",
                e.response.status_code,
                e.response.text,
            )
            raise WhatsAppAPIError(e.response.status_code, e.response.text) from e
        except httpx.TimeoutException as e:
            logger.error("WhatsApp API request timed out: %s", e)
            raise
        except httpx.ConnectError as e:
            logger.error("WhatsApp API connection error: %s", e)
            raise

    async def close(self) -> None:
        """Close the underlying HTTP client. Call during app shutdown."""
        await self._client.aclose()
