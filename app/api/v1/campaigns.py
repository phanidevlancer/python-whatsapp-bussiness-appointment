import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_whatsapp_client, require_permission
from app.db.session import get_db
from app.models.campaign import Campaign
from app.repositories import campaign_repository as campaign_repo
from app.schemas.campaign import CampaignCreate, CampaignRead, CampaignUpdate
from app.services import campaign_media_service as campaign_media_svc
from app.services import campaign_runner_service as campaign_runner_svc

router = APIRouter()


@router.get("/", response_model=list[CampaignRead])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("services.manage")),
):
    campaigns = await campaign_repo.list_campaigns(db)
    payloads: list[CampaignRead] = []
    for campaign in campaigns:
        recipients_payload = await campaign_repo.list_campaign_recipients(db, campaign_id=campaign.id)
        if recipients_payload is None:
            continue
        metrics = recipients_payload["metrics"]
        payloads.append(
            CampaignRead.model_validate(
                {
                    "id": str(campaign.id),
                    "code": campaign.code,
                    "name": campaign.name,
                    "description": getattr(campaign, "description", None),
                    "status": campaign.status,
                    "audience_type": getattr(campaign, "audience_type", None),
                    "audience_filters": getattr(campaign, "audience_filters", None) or {},
                    "run_status": recipients_payload["run_status"],
                    "message_body": getattr(campaign, "message_body", None),
                    "message_footer": getattr(campaign, "message_footer", None),
                    "button_label": getattr(campaign, "button_label", None),
                    "image_path": getattr(campaign, "image_path", None),
                    "image_media_id": getattr(campaign, "image_media_id", None),
                    "batch_size": getattr(campaign, "batch_size", None),
                    "batch_delay_seconds": getattr(campaign, "batch_delay_seconds", None),
                    "started_at": getattr(campaign, "started_at", None),
                    "completed_at": getattr(campaign, "completed_at", None),
                    "failed_at": getattr(campaign, "failed_at", None),
                    "last_error": getattr(campaign, "last_error", None),
                    "booking_button_id": getattr(campaign, "booking_button_id", None),
                    "allowed_service_ids": getattr(campaign, "allowed_service_ids", []),
                    "allowed_weekdays": getattr(campaign, "allowed_weekdays", []),
                    "valid_from": getattr(campaign, "valid_from", None),
                    "valid_to": getattr(campaign, "valid_to", None),
                    "per_user_booking_limit": getattr(campaign, "per_user_booking_limit", None),
                    "discount_type": getattr(campaign, "discount_type", None),
                    "discount_value": getattr(campaign, "discount_value", None),
                    "targeted": metrics["targeted"],
                    "pending": metrics["pending"],
                    "sent": metrics["sent"],
                    "delivered": metrics["delivered"],
                    "read": metrics["read"],
                    "clicked": metrics["clicked"],
                    "failed": metrics["failed"],
                    "bookings": metrics["bookings"],
                    "confirmed": metrics["confirmed"],
                    "cancelled": metrics["cancelled"],
                    "completed": metrics["completed"],
                    "no_show": metrics["no_show"],
                    "total_service_value": metrics["total_service_value"],
                    "total_final_value": metrics["total_final_value"],
                    "source_comparison": [],
                    "created_at": campaign.created_at,
                    "updated_at": campaign.updated_at,
                }
            )
        )
    return payloads


@router.post("/", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("services.manage")),
):
    existing = await campaign_repo.get_campaign_by_code(db, payload.code)
    if existing:
        raise HTTPException(status_code=409, detail="Campaign code already exists")

    campaign = Campaign(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        booking_button_id=payload.booking_button_id,
        allowed_service_ids=[str(service_id) for service_id in payload.allowed_service_ids],
        allowed_weekdays=payload.allowed_weekdays,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        per_user_booking_limit=payload.per_user_booking_limit,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        audience_type=payload.audience_type,
        audience_filters=payload.audience_filters,
        message_body=payload.message_body,
        message_footer=payload.message_footer,
        button_label=payload.button_label,
        image_path=payload.image_path,
        batch_size=payload.batch_size,
        batch_delay_seconds=payload.batch_delay_seconds,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


@router.patch("/{campaign_id}", response_model=CampaignRead)
async def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("services.manage")),
):
    campaign = await campaign_repo.get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    updates = payload.model_dump(exclude_unset=True)
    if "allowed_service_ids" in updates and updates["allowed_service_ids"] is not None:
        updates["allowed_service_ids"] = [str(service_id) for service_id in updates["allowed_service_ids"]]

    for key, value in updates.items():
        setattr(campaign, key, value)

    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_campaign_image(
    file: UploadFile = File(...),
    _=Depends(require_permission("services.manage")),
):
    stored_image = await campaign_media_svc.store_campaign_image(file)
    return {
        "relative_path": stored_image.relative_path,
        "filename": stored_image.original_filename,
        "content_type": stored_image.content_type,
        "size_bytes": stored_image.size_bytes,
    }


@router.post("/{campaign_id}/start")
@router.post("/{campaign_id}/send-now")
async def start_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    whatsapp_client=Depends(get_whatsapp_client),
    _=Depends(require_permission("services.manage")),
):
    campaign = await campaign_runner_svc.launch_campaign(
        db,
        campaign_id=campaign_id,
        whatsapp_client=whatsapp_client,
    )
    await db.commit()
    await campaign_runner_svc.dispatch_campaign(
        campaign_id=campaign.id,
        whatsapp_client=whatsapp_client,
    )
    detail = await campaign_repo.get_campaign_detail(db, campaign_id=campaign.id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return detail


@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("services.manage")),
):
    campaign = await campaign_runner_svc.pause_campaign(db, campaign_id=campaign_id)
    detail = await campaign_repo.get_campaign_detail(db, campaign_id=campaign.id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return detail


@router.get("/{campaign_id}")
async def get_campaign_detail(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("services.manage")),
):
    detail = await campaign_repo.get_campaign_detail(db, campaign_id=campaign_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return detail


@router.get("/{campaign_id}/recipients")
async def list_campaign_recipients(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("services.manage")),
):
    recipients = await campaign_repo.list_campaign_recipients(db, campaign_id=campaign_id)
    if recipients is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return recipients
