"""
Server-Sent Events endpoint for real-time CRM updates.

Clients connect to GET /api/v1/events and receive push notifications
whenever an appointment is created, updated, cancelled, or rescheduled.
"""
import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory set of active subscriber queues
_subscribers: set[asyncio.Queue] = set()


def broadcast(event_type: str, payload: dict) -> None:
    """Push an event to all connected SSE clients (fire-and-forget)."""
    message = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"
    dead = set()
    for q in _subscribers:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead.add(q)
    _subscribers.difference_update(dead)


async def _event_stream(request: Request) -> AsyncGenerator[str, None]:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.add(q)
    try:
        # Initial heartbeat so the browser knows the connection is alive
        yield ": connected\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                message = await asyncio.wait_for(q.get(), timeout=25)
                yield message
            except asyncio.TimeoutError:
                # Keepalive comment every 25 s to prevent proxy timeouts
                yield ": keepalive\n\n"
    finally:
        _subscribers.discard(q)


@router.get("/events")
async def sse_endpoint(request: Request, token: str | None = None):
    # Validate token — EventSource can't send headers, so token comes as query param
    from app.core.security import decode_access_token
    from jose import JWTError
    if not token:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decode_access_token(token)
    except JWTError:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid token")

    return StreamingResponse(
        _event_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
