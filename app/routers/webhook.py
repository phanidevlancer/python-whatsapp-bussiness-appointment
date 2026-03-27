import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from redis.asyncio import Redis

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.integrations.whatsapp_client import WhatsAppClient
from app.services.booking_flow_service import handle_incoming_message
from app.services.session_service import SessionService

logger = logging.getLogger(__name__)

router = APIRouter()


def get_redis(request: Request) -> Redis:
    return request.app.state.redis


def get_whatsapp_client(request: Request) -> WhatsAppClient:
    return request.app.state.whatsapp_client


def get_session_service(redis: Redis = Depends(get_redis)) -> SessionService:
    return SessionService(redis)


@router.get("", summary="Meta webhook verification", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
) -> str:
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        return hub_challenge
    raise HTTPException(status_code=403, detail="Forbidden: invalid verify token")


@router.post("", summary="Receive inbound WhatsApp messages")
async def receive_webhook(
    request: Request,
    session_svc: SessionService = Depends(get_session_service),
    wa_client: WhatsAppClient = Depends(get_whatsapp_client),
) -> dict:
    payload = await request.json()
    logger.info("Webhook received")

    try:
        async with AsyncSessionLocal() as db:
            await handle_incoming_message(payload, db, session_svc, wa_client)
            logger.info("About to commit, session dirty=%s new=%s", db.dirty, db.new)
            await db.commit()
            logger.info("Committed successfully")
    except Exception as e:
        print(f"WEBHOOK ERROR: {e}", flush=True)
        traceback.print_exc()
        logger.exception("Error processing webhook")

    return {"status": "ok"}
