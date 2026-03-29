import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.models.campaign import Campaign
from app.repositories import campaign_repository as campaign_repo
from app.schemas.campaign import CampaignCreate, CampaignRead, CampaignUpdate
from app.services import campaign_media_service as campaign_media_svc

router = APIRouter()


@router.get("/", response_model=list[CampaignRead])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("services.manage")),
):
    campaigns = await campaign_repo.list_campaigns(db)
    return [CampaignRead.model_validate(campaign) for campaign in campaigns]


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
    )
    db.add(campaign)
    await db.flush()
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
