import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

import app.db.base  # noqa: F401 — must be first to register all models with SQLAlchemy

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import engine, AsyncSessionLocal
from app.integrations.whatsapp_client import WhatsAppClient
from app.routers.webhook import router as webhook_router

# CRM routers
from app.api.v1 import auth, appointments, customers, services, providers, slots, notifications, dashboard
from app.api.v1 import events as sse

# Events + notification service
from app.events import event_dispatcher
from app.events.appointment_events import (
    AppointmentCreatedEvent,
    AppointmentCancelledEvent,
    AppointmentRescheduledEvent,
    AppointmentStatusChangedEvent,
)
from app.services import notification_service as notif_svc

# Configure logging before anything else runs
configure_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Startup: initialise shared resources (Redis, WhatsApp client, notification service, events).
    Shutdown: close all connections cleanly.
    """
    logger.info("Starting up WhatsApp Booking API (env=%s)", settings.APP_ENV)

    # Redis async client (connection is lazy — first actual command connects)
    app.state.redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)

    # WhatsApp API client (single httpx.AsyncClient shared across requests)
    app.state.whatsapp_client = WhatsAppClient(
        token=settings.WHATSAPP_TOKEN,
        phone_number_id=settings.WHATSAPP_PHONE_NUMBER_ID,
    )

    # Initialize notification service with shared wa_client + session factory
    notif_svc.init_notification_service(
        wa_client=app.state.whatsapp_client,
        session_factory=AsyncSessionLocal,
    )

    # Register event → notification handlers
    event_dispatcher.register(AppointmentCreatedEvent, notif_svc.on_appointment_created)
    event_dispatcher.register(AppointmentCancelledEvent, notif_svc.on_appointment_cancelled)
    event_dispatcher.register(AppointmentRescheduledEvent, notif_svc.on_appointment_rescheduled)

    # Register event → SSE broadcast handlers
    async def _sse_created(e: AppointmentCreatedEvent):
        sse.broadcast("appointment_created", {"appointment_id": str(e.appointment_id)})

    async def _sse_cancelled(e: AppointmentCancelledEvent):
        sse.broadcast("appointment_updated", {"appointment_id": str(e.appointment_id)})

    async def _sse_rescheduled(e: AppointmentRescheduledEvent):
        sse.broadcast("appointment_updated", {"appointment_id": str(e.appointment_id)})

    async def _sse_status_changed(e: AppointmentStatusChangedEvent):
        sse.broadcast("appointment_updated", {"appointment_id": str(e.appointment_id)})

    event_dispatcher.register(AppointmentCreatedEvent, _sse_created)
    event_dispatcher.register(AppointmentCancelledEvent, _sse_cancelled)
    event_dispatcher.register(AppointmentRescheduledEvent, _sse_rescheduled)
    event_dispatcher.register(AppointmentStatusChangedEvent, _sse_status_changed)

    logger.info("Startup complete")
    yield

    # --- Shutdown ---
    logger.info("Shutting down...")
    await app.state.redis.aclose()
    await app.state.whatsapp_client.close()
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title="WhatsApp Appointment Booking + CRM",
    description="WhatsApp booking bot + internal admin CRM",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS for the Next.js CRM frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing WhatsApp webhook (untouched) ──────────────────────────────────
app.include_router(webhook_router, prefix="/webhook", tags=["webhook"])

# ── CRM API v1 ─────────────────────────────────────────────────────────────
API_V1 = "/api/v1"
app.include_router(auth.router,          prefix=f"{API_V1}/auth",          tags=["auth"])
app.include_router(dashboard.router,     prefix=f"{API_V1}/dashboard",     tags=["dashboard"])
app.include_router(appointments.router,  prefix=f"{API_V1}/appointments",  tags=["appointments"])
app.include_router(customers.router,     prefix=f"{API_V1}/customers",     tags=["customers"])
app.include_router(services.router,      prefix=f"{API_V1}/services",      tags=["services"])
app.include_router(providers.router,     prefix=f"{API_V1}/providers",     tags=["providers"])
app.include_router(slots.router,         prefix=f"{API_V1}/slots",         tags=["slots"])
app.include_router(notifications.router, prefix=f"{API_V1}/notifications", tags=["notifications"])
app.include_router(sse.router,           prefix=f"{API_V1}",              tags=["events"])


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Simple liveness probe."""
    return {"status": "ok", "env": settings.APP_ENV, "version": "2.0.0"}
