"""
Server-Sent Events endpoint for real-time CRM updates.
"""
import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Global set of active subscriber queues
_subscribers: set[asyncio.Queue] = set()


def broadcast(event_type: str, payload: dict) -> None:
    """Push an event to all connected SSE clients."""
    message = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"
    dead = set()
    for q in _subscribers:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead.add(q)
    _subscribers.difference_update(dead)
    logger.debug("SSE broadcast %s to %d clients", event_type, len(_subscribers))


@router.get("/events")
async def sse_endpoint(token: str = Query(...)):
    from app.core.security import decode_access_token
    from jose import JWTError
    try:
        decode_access_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)
    logger.info("SSE client connected. Total: %d", len(_subscribers))

    async def stream():
        try:
            # Initial connection confirmation
            yield ": connected\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(q.get(), timeout=20)
                    yield message
                except asyncio.TimeoutError:
                    # Keepalive ping every 20s
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            _subscribers.discard(q)
            logger.info("SSE client disconnected. Total: %d", len(_subscribers))

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
