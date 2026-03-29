from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import uuid

from fastapi import HTTPException, status

from app.models.campaign import CampaignDiscountType, CampaignStatus
from app.repositories import campaign_repository as campaign_repo
from app.repositories import session_repository as sess_repo

CAMPAIGN_BUTTON_PREFIX = "campaign_book:"


def parse_campaign_button_id(button_id: str | None) -> str | None:
    if not button_id or not button_id.startswith(CAMPAIGN_BUTTON_PREFIX):
        return None
    code = button_id[len(CAMPAIGN_BUTTON_PREFIX):].strip()
    return code or None


def is_service_eligible(campaign, service_id: uuid.UUID) -> bool:
    allowed_service_ids = getattr(campaign, "allowed_service_ids", None) or []
    if not allowed_service_ids:
        return True
    return str(service_id) in {str(value) for value in allowed_service_ids}


def is_slot_eligible(campaign, slot_start: datetime) -> bool:
    valid_from = getattr(campaign, "valid_from", None)
    valid_to = getattr(campaign, "valid_to", None)
    allowed_weekdays = getattr(campaign, "allowed_weekdays", None) or []

    if valid_from and slot_start < valid_from:
        return False
    if valid_to and slot_start > valid_to:
        return False
    if allowed_weekdays and slot_start.weekday() not in {int(value) for value in allowed_weekdays}:
        return False
    return True


def is_campaign_active(campaign, at_time: datetime | None = None) -> bool:
    if campaign is None:
        return False
    if getattr(campaign, "status", CampaignStatus.ACTIVE) != CampaignStatus.ACTIVE:
        return False
    if at_time is None:
        at_time = datetime.now(timezone.utc)
    valid_from = getattr(campaign, "valid_from", None)
    valid_to = getattr(campaign, "valid_to", None)
    if valid_from and at_time < valid_from:
        return False
    if valid_to and at_time > valid_to:
        return False
    return True


def build_booking_snapshot(session, campaign) -> dict[str, object | None]:
    journey_type = getattr(session, "active_journey_type", "organic")
    journey_value = getattr(journey_type, "value", journey_type)
    if journey_value != "campaign" or campaign is None:
        return {
            "campaign_id": None,
            "campaign_code_snapshot": None,
            "campaign_name_snapshot": None,
            "discount_type_snapshot": None,
            "discount_value_snapshot": None,
        }

    discount_value = getattr(campaign, "discount_value", None)
    if isinstance(discount_value, Decimal) and discount_value == discount_value.to_integral():
        discount_value = int(discount_value)

    return {
        "campaign_id": campaign.id,
        "campaign_code_snapshot": campaign.code,
        "campaign_name_snapshot": campaign.name,
        "discount_type_snapshot": getattr(campaign, "discount_type", None),
        "discount_value_snapshot": discount_value,
    }


def calculate_final_cost(service_cost: Decimal, campaign) -> Decimal:
    service_cost = Decimal(service_cost).quantize(Decimal("0.01"))
    discount_type = getattr(campaign, "discount_type", CampaignDiscountType.NONE)
    discount_value = getattr(campaign, "discount_value", None)

    if discount_value is None or discount_type in {CampaignDiscountType.NONE, "none", None}:
        return service_cost

    discount_value = Decimal(discount_value)
    if discount_type in {CampaignDiscountType.PERCENT, "percent"}:
        final_cost = service_cost - ((service_cost * discount_value) / Decimal("100"))
    elif discount_type in {CampaignDiscountType.FLAT, "flat"}:
        final_cost = service_cost - discount_value
    else:
        final_cost = service_cost

    if final_cost < Decimal("0.00"):
        final_cost = Decimal("0.00")
    return final_cost.quantize(Decimal("0.01"))


def ensure_booking_limit(campaign, *, existing_count: int) -> None:
    if is_booking_limit_reached(campaign, existing_count=existing_count):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Booking limit reached for campaign '{campaign.name}'.",
        )


def is_booking_limit_reached(campaign, *, existing_count: int) -> bool:
    limit = getattr(campaign, "per_user_booking_limit", None)
    return limit is not None and existing_count >= limit


async def start_organic_journey(
    db,
    user_phone: str,
    *,
    entry_point: str,
    entry_message_id: str | None,
):
    await sess_repo.reset_session(db, user_phone)
    return await sess_repo.mark_journey(
        db,
        user_phone,
        journey_type="organic",
        campaign_id=None,
        entry_point=entry_point,
        entry_message_id=entry_message_id,
    )


async def start_campaign_journey(
    db,
    user_phone: str,
    *,
    campaign,
    entry_point: str,
    entry_message_id: str | None,
):
    await sess_repo.reset_session(db, user_phone)
    return await sess_repo.mark_journey(
        db,
        user_phone,
        journey_type="campaign",
        campaign_id=campaign.id,
        entry_point=entry_point,
        entry_message_id=entry_message_id,
    )


async def resolve_active_campaign(db, session):
    campaign_id = getattr(session, "active_campaign_id", None)
    if not campaign_id:
        return None
    return await campaign_repo.get_campaign_by_id(db, campaign_id)
