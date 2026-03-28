import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

import app.db.base  # noqa: F401 — must be first to register all models with SQLAlchemy

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import engine, AsyncSessionLocal
from app.db.seed import run_seed as run_rbac_seed
from app.integrations.whatsapp_client import WhatsAppClient
from app.routers.webhook import router as webhook_router

# CRM routers
from app.api.v1 import auth, appointments, customers, services, providers, slots, notifications, dashboard, leads, leads_analytics, role_templates, permissions, users
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


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _should_bootstrap_rbac_seed() -> bool:
    if settings.APP_ENV.lower() not in {"development", "local"}:
        return False
    return _env_flag("RBAC_BOOTSTRAP_ON_STARTUP", False)


async def _maybe_bootstrap_rbac_seed() -> None:
    if not _should_bootstrap_rbac_seed():
        return

    logger.info("RBAC bootstrap enabled; seeding permissions, templates, and legacy backfill")
    await run_rbac_seed()


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

    await _maybe_bootstrap_rbac_seed()

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
app.include_router(users.router,         prefix=f"{API_V1}/users",         tags=["users"])
app.include_router(role_templates.router, prefix=f"{API_V1}/role-templates", tags=["role-templates"])
app.include_router(permissions.router,   prefix=f"{API_V1}/permissions",    tags=["permissions"])
app.include_router(leads.router,         prefix=f"{API_V1}/leads",         tags=["leads"])
app.include_router(leads_analytics.router, prefix=f"{API_V1}/leads/analytics", tags=["leads-analytics"])
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
