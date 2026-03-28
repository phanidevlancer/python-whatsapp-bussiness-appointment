"""
Event Broadcaster for Server-Sent Events (SSE)

Manages real-time event broadcasting to connected clients.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Callable, Dict, Set
import uuid
import json

logger = logging.getLogger(__name__)


# Global connection manager
class EventConnectionManager:
    """Manages SSE connections for real-time event streaming."""
    
    def __init__(self):
        # Map of client_id -> queue for event messages
        self._connections: Dict[str, asyncio.Queue] = {}
        # Map of event_type -> set of client_ids subscribed to that event
        self._subscriptions: Dict[str, Set[str]] = {}
        self._lock = asyncio.Lock()
    
    async def register(self, client_id: str) -> asyncio.Queue:
        """Register a new SSE connection."""
        async with self._lock:
            queue = asyncio.Queue()
            self._connections[client_id] = queue
            logger.info("SSE client registered: %s", client_id)
            return queue
    
    async def unregister(self, client_id: str) -> None:
        """Unregister an SSE connection."""
        async with self._lock:
            if client_id in self._connections:
                del self._connections[client_id]
            # Remove from all subscriptions
            for subscribers in self._subscriptions.values():
                subscribers.discard(client_id)
            logger.info("SSE client unregistered: %s", client_id)
    
    async def subscribe(self, client_id: str, event_type: str) -> None:
        """Subscribe a client to a specific event type."""
        async with self._lock:
            if event_type not in self._subscriptions:
                self._subscriptions[event_type] = set()
            self._subscriptions[event_type].add(client_id)
    
    async def unsubscribe(self, client_id: str, event_type: str) -> None:
        """Unsubscribe a client from an event type."""
        async with self._lock:
            if event_type in self._subscriptions:
                self._subscriptions[event_type].discard(client_id)
    
    async def broadcast(self, event_type: str, data: dict) -> None:
        """
        Broadcast an event to all subscribed clients.
        
        Args:
            event_type: Type of event (e.g., "lead.created")
            data: Event payload data
        """
        event_message = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        message_json = json.dumps(event_message)
        
        async with self._lock:
            subscribers = self._subscriptions.get(event_type, set()).copy()
        
        # Send to all subscribers
        for client_id in subscribers:
            if client_id in self._connections:
                try:
                    await self._connections[client_id].put(message_json)
                except asyncio.QueueFull:
                    logger.warning("Queue full for client %s, removing", client_id)
                    await self.unregister(client_id)
        
        # Also send to "all" subscribers if different event type
        if event_type != "all":
            await self.broadcast("all", event_message)
    
    async def send_to_client(self, client_id: str, data: dict) -> None:
        """Send an event to a specific client."""
        if client_id not in self._connections:
            return
        
        event_message = {
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        try:
            await self._connections[client_id].put(json.dumps(event_message))
        except asyncio.QueueFull:
            logger.warning("Queue full for client %s", client_id)


# Singleton instance
_connection_manager = EventConnectionManager()


def get_connection_manager() -> EventConnectionManager:
    """Get the global connection manager instance."""
    return _connection_manager


async def broadcast_event(event_type: str, data: dict) -> None:
    """
    Broadcast an event to all subscribed clients.
    
    Args:
        event_type: Type of event (e.g., "lead.created", "appointment.booked")
        data: Event payload data
    """
    await _connection_manager.broadcast(event_type, data)


async def stream_events(client_id: str) -> AsyncGenerator[str, None]:
    """
    Stream events to a client via SSE.
    
    Usage:
        @router.get("/events")
        async def events(request: Request):
            client_id = str(uuid.uuid4())
            return StreamingResponse(
                stream_events(client_id),
                media_type="text/event-stream",
            )
    
    Args:
        client_id: Unique identifier for the client
        
    Yields:
        SSE-formatted event messages
    """
    queue = await _connection_manager.register(client_id)
    
    try:
        while True:
            message = await queue.get()
            # SSE format: data: {message}\n\n
            yield f"data: {message}\n\n"
    except asyncio.CancelledError:
        logger.info("SSE stream cancelled for client %s", client_id)
    finally:
        await _connection_manager.unregister(client_id)
