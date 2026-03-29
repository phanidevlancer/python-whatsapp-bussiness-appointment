from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path
import inspect
import uuid

from fastapi import HTTPException, status

from app.db.session import AsyncSessionLocal
from app.models.campaign import CampaignRunStatus, CampaignStatus
from app.models.campaign_recipient import CampaignDeliveryStatus
from app.repositories import campaign_repository as campaign_repo
from app.services import campaign_audience_service as campaign_audience_svc
from app.services import campaign_media_service as campaign_media_svc
from app.services import campaign_service as campaign_svc

DispatchCampaign = Callable[..., Awaitable[object] | object]

DEFAULT_BATCH_SIZE = 50
DEFAULT_BUTTON_LABEL = "Book now"


def _status_value(value: object | None) -> str | None:
    return getattr(value, "value", value)


def infer_campaign_run_status(campaign: object, *, pending_count: int = 0) -> CampaignRunStatus:
    status_value = _status_value(getattr(campaign, "status", None))
    if status_value == CampaignStatus.PAUSED.value:
        return CampaignRunStatus.PAUSED
    if getattr(campaign, "failed_at", None):
        return CampaignRunStatus.FAILED
    if getattr(campaign, "completed_at", None):
        return CampaignRunStatus.COMPLETED
    if getattr(campaign, "started_at", None):
        return CampaignRunStatus.RUNNING if pending_count > 0 else CampaignRunStatus.COMPLETED
    return CampaignRunStatus.DRAFT


def _batch_size(campaign: object) -> int:
    return int(getattr(campaign, "batch_size", None) or DEFAULT_BATCH_SIZE)


def _build_button_payload(campaign: object) -> list[dict[str, str]]:
    button_id = getattr(campaign, "booking_button_id", None) or f"{campaign_svc.CAMPAIGN_BUTTON_PREFIX}{campaign.code}"
    button_title = getattr(campaign, "button_label", None) or DEFAULT_BUTTON_LABEL
    return [{"id": button_id, "title": button_title}]


def _extract_provider_message_id(response: object) -> str | None:
    if not isinstance(response, dict):
        return None
    messages = response.get("messages")
    if isinstance(messages, list) and messages:
        first = messages[0]
        if isinstance(first, dict):
            return first.get("id") or first.get("message_id")
    return response.get("id") if isinstance(response.get("id"), str) else None


async def _dispatch_background_campaign(
    *,
    campaign_id: uuid.UUID,
    whatsapp_client,
) -> asyncio.Task:
    return asyncio.create_task(run_campaign_batches(campaign_id=campaign_id, whatsapp_client=whatsapp_client))


async def dispatch_campaign(
    *,
    campaign_id: uuid.UUID,
    whatsapp_client,
    dispatch: DispatchCampaign | None = None,
) -> None:
    dispatcher = dispatch or _dispatch_background_campaign
    dispatched = dispatcher(campaign_id=campaign_id, whatsapp_client=whatsapp_client)
    if inspect.isawaitable(dispatched):
        await dispatched


async def _pending_count(db, *, campaign_id: uuid.UUID) -> int:
    count_pending_recipients = getattr(campaign_repo, "count_pending_recipients", None)
    if count_pending_recipients is None or not hasattr(db, "execute"):
        return 0
    return await count_pending_recipients(db, campaign_id=campaign_id)


def _validate_message_contract(campaign: object) -> None:
    if not getattr(campaign, "message_body", None):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Campaign message_body is required before launch",
        )


async def validate_campaign_launchable(db, campaign: object) -> None:
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if _status_value(getattr(campaign, "status", None)) == CampaignStatus.EXPIRED.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Expired campaigns cannot be launched")

    pending_count = await _pending_count(db, campaign_id=campaign.id)
    run_status = infer_campaign_run_status(campaign, pending_count=pending_count)
    if run_status == CampaignRunStatus.RUNNING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign is already running")
    if run_status == CampaignRunStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign has already completed")

    _validate_message_contract(campaign)


async def launch_campaign(
    db,
    *,
    campaign_id: uuid.UUID,
    whatsapp_client,
):
    del whatsapp_client
    campaign = await campaign_repo.get_campaign_by_id_for_update(db, campaign_id)
    await validate_campaign_launchable(db, campaign)

    drafts = await campaign_audience_svc.resolve_campaign_audience(db, campaign)
    if not drafts:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Campaign audience resolved to zero recipients")

    await campaign_repo.bulk_create_recipients_from_drafts(db, campaign=campaign, drafts=drafts)

    campaign.status = CampaignStatus.ACTIVE
    campaign.started_at = getattr(campaign, "started_at", None) or datetime.now(timezone.utc)
    campaign.completed_at = None
    campaign.failed_at = None
    campaign.last_error = None
    campaign.run_status = CampaignRunStatus.RUNNING
    await db.flush()
    return campaign


def _campaign_image_record(campaign: object) -> campaign_media_svc.StoredCampaignImage:
    relative_path = str(getattr(campaign, "image_path", ""))
    absolute_path = Path.cwd() / relative_path
    return campaign_media_svc.StoredCampaignImage(
        relative_path=relative_path,
        absolute_path=absolute_path,
        original_filename=absolute_path.name,
        content_type=None,
        size_bytes=0,
    )


async def _resolve_campaign_media_id(campaign: object, whatsapp_client) -> str | None:
    image_media_id = getattr(campaign, "image_media_id", None)
    image_path = getattr(campaign, "image_path", None)
    if image_media_id:
        return image_media_id
    if not image_path:
        return None
    media_id = await campaign_media_svc.ensure_campaign_image_media_id(
        whatsapp_client,
        _campaign_image_record(campaign),
        image_media_id=image_media_id,
    )
    campaign.image_media_id = media_id
    return media_id


async def process_campaign_batch(db, campaign: object, *, whatsapp_client) -> int:
    recipients = await campaign_repo.list_pending_recipients(
        db,
        campaign_id=campaign.id,
        limit=_batch_size(campaign),
    )
    if not recipients:
        return 0

    media_id = await _resolve_campaign_media_id(campaign, whatsapp_client)
    buttons = _build_button_payload(campaign)
    processed = 0

    for recipient in recipients:
        processed += 1
        try:
            if media_id:
                response = await whatsapp_client.send_image_button_message(
                    to=recipient.phone,
                    body=campaign.message_body,
                    media_id=media_id,
                    buttons=buttons,
                    footer=getattr(campaign, "message_footer", None),
                )
            else:
                response = await whatsapp_client.send_button_message(
                    to=recipient.phone,
                    body=campaign.message_body,
                    buttons=buttons,
                )
            provider_message_id = _extract_provider_message_id(response)
            await campaign_repo.update_recipient_status(
                db,
                recipient=recipient,
                delivery_status=CampaignDeliveryStatus.SENT,
                provider_message_id=provider_message_id,
                error_message=None,
            )
            await campaign_repo.create_send_log(
                db,
                campaign_id=campaign.id,
                recipient_id=recipient.id,
                provider_message_id=provider_message_id,
                status=CampaignDeliveryStatus.SENT,
                sent_at=datetime.now(timezone.utc),
                error_message=None,
            )
        except Exception as exc:
            error_message = str(exc)
            await campaign_repo.update_recipient_status(
                db,
                recipient=recipient,
                delivery_status=CampaignDeliveryStatus.FAILED,
                provider_message_id=None,
                error_message=error_message,
            )
            await campaign_repo.create_send_log(
                db,
                campaign_id=campaign.id,
                recipient_id=recipient.id,
                provider_message_id=None,
                status=CampaignDeliveryStatus.FAILED,
                sent_at=None,
                error_message=error_message,
            )

    campaign.run_status = infer_campaign_run_status(campaign, pending_count=max(0, await _pending_count(db, campaign_id=campaign.id)))
    await db.flush()
    return processed


async def pause_campaign(db, *, campaign_id: uuid.UUID):
    campaign = await campaign_repo.get_campaign_by_id(db, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    campaign.status = CampaignStatus.PAUSED
    campaign.run_status = CampaignRunStatus.PAUSED
    await db.flush()
    return campaign


async def run_campaign_batches(
    *,
    campaign_id: uuid.UUID,
    whatsapp_client,
    session_factory=AsyncSessionLocal,
    sleep: Callable[[float], Awaitable[object]] = asyncio.sleep,
) -> None:
    while True:
        async with session_factory() as db:
            campaign = await campaign_repo.get_campaign_by_id(db, campaign_id)
            if campaign is None:
                await db.rollback()
                return

            if _status_value(getattr(campaign, "status", None)) == CampaignStatus.PAUSED.value:
                campaign.run_status = CampaignRunStatus.PAUSED
                await db.flush()
                await db.commit()
                return

            try:
                pending_before = await _pending_count(db, campaign_id=campaign_id)
                if pending_before == 0:
                    if getattr(campaign, "started_at", None) and getattr(campaign, "completed_at", None) is None:
                        campaign.completed_at = datetime.now(timezone.utc)
                    campaign.last_error = None
                    campaign.run_status = CampaignRunStatus.COMPLETED
                    await db.flush()
                    await db.commit()
                    return

                await process_campaign_batch(db, campaign, whatsapp_client=whatsapp_client)

                pending_after = await _pending_count(db, campaign_id=campaign_id)
                if pending_after == 0:
                    campaign.completed_at = datetime.now(timezone.utc)
                    campaign.failed_at = None
                    campaign.last_error = None
                    campaign.run_status = CampaignRunStatus.COMPLETED
                    await db.flush()
                    await db.commit()
                    return

                campaign.run_status = CampaignRunStatus.RUNNING
                await db.commit()
                delay_seconds = int(getattr(campaign, "batch_delay_seconds", None) or 0)
            except Exception as exc:
                campaign.failed_at = datetime.now(timezone.utc)
                campaign.last_error = str(exc)
                campaign.run_status = CampaignRunStatus.FAILED
                await db.flush()
                await db.commit()
                return

        if delay_seconds > 0:
            await sleep(delay_seconds)
