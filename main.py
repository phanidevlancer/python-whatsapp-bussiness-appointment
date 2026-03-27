import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

import app.db.base  # noqa: F401 — must be first to register all models with SQLAlchemy

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import engine
from app.integrations.whatsapp_client import WhatsAppClient
from app.routers.webhook import router as webhook_router

# Configure logging before anything else runs
configure_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Startup: initialise shared resources (Redis, WhatsApp client).
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

    logger.info("Startup complete")
    yield

    # --- Shutdown ---
    logger.info("Shutting down...")
    await app.state.redis.aclose()
    await app.state.whatsapp_client.close()
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title="WhatsApp Appointment Booking",
    description="Automated appointment booking via Meta WhatsApp Cloud API",
    version="1.0.0",
    lifespan=lifespan,
)

# Register routers
app.include_router(webhook_router, prefix="/webhook", tags=["webhook"])


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
    return {"status": "ok", "env": settings.APP_ENV}
