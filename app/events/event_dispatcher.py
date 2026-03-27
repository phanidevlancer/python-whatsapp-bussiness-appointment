import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)

_registry: dict[type, list[Callable]] = {}


def register(event_type: type, handler: Callable) -> None:
    _registry.setdefault(event_type, []).append(handler)


async def dispatch(event: Any) -> None:
    handlers = _registry.get(type(event), [])
    for handler in handlers:
        try:
            await handler(event)
        except Exception:
            logger.exception("Event handler %s failed for event %s", handler.__name__, type(event).__name__)
