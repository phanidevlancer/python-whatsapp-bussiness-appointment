from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import CampaignAudienceType
from app.repositories import customer_repository as customer_repo


@dataclass(slots=True)
class AudienceRecipientDraft:
    phone: str
    display_name: str
    customer_id: uuid.UUID | None
    source_type: str


def _audience_type_value(campaign: object) -> str:
    audience_type = getattr(campaign, "audience_type", None)
    return getattr(audience_type, "value", audience_type)


def _unique_drafts(drafts: Iterable[AudienceRecipientDraft]) -> list[AudienceRecipientDraft]:
    seen: dict[str, AudienceRecipientDraft] = {}
    order: list[str] = []

    for draft in drafts:
        if draft.phone in seen:
            continue
        seen[draft.phone] = draft
        order.append(draft.phone)

    return [seen[phone] for phone in order]


def _customer_name(customer: object) -> str:
    name = getattr(customer, "name", None)
    if name:
        return str(name)
    phone = customer_repo.normalize_phone(str(getattr(customer, "phone", "")))
    return phone or str(getattr(customer, "phone", ""))


def _customer_phone(customer: object) -> str | None:
    phone = getattr(customer, "phone", None)
    if phone is None:
        return None
    normalized = customer_repo.normalize_phone(str(phone))
    return normalized or None


def _customer_draft(customer: object, *, source_type: str) -> AudienceRecipientDraft | None:
    phone = _customer_phone(customer)
    if not phone:
        return None
    return AudienceRecipientDraft(
        phone=phone,
        display_name=_customer_name(customer),
        customer_id=getattr(customer, "id", None),
        source_type=source_type,
    )


def _parse_positive_days(filters: dict[str, object], field_name: str = "inactive_days") -> int:
    value = filters.get(field_name)
    if value is None:
        raise ValueError(
            "audience_filters['inactive_days'] is required for customers_inactive_for_days campaigns"
        )
    if isinstance(value, bool):
        raise ValueError("audience_filters['inactive_days'] must be a positive integer")
    try:
        days = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("audience_filters['inactive_days'] must be a positive integer") from exc
    if days <= 0:
        raise ValueError("audience_filters['inactive_days'] must be greater than 0")
    return days


def _uploaded_phones(campaign: object) -> list[str]:
    filters = getattr(campaign, "audience_filters", None) or {}
    raw_phones = None
    for key in ("phones", "phone_numbers", "phone_list"):
        raw_phones = filters.get(key)
        if raw_phones is not None:
            break

    if raw_phones is None:
        return []
    if isinstance(raw_phones, str):
        raw_phones = [raw_phones]
    if not isinstance(raw_phones, Iterable):
        raise ValueError("audience_filters['phones'] must be a list of phone numbers")

    normalized: list[str] = []
    for phone in raw_phones:
        if phone is None:
            continue
        candidate = customer_repo.normalize_phone(str(phone))
        if candidate:
            normalized.append(candidate)
    return normalized


async def resolve_campaign_audience(
    db: AsyncSession,
    campaign: object,
) -> list[AudienceRecipientDraft]:
    audience_type = _audience_type_value(campaign)

    if audience_type == CampaignAudienceType.ALL_CUSTOMERS.value:
        customers = await customer_repo.list_contactable_customers(db)
        drafts = [_customer_draft(customer, source_type=audience_type) for customer in customers]
        return _unique_drafts([draft for draft in drafts if draft is not None])

    if audience_type == CampaignAudienceType.CUSTOMERS_WITH_PREVIOUS_BOOKINGS.value:
        customers = await customer_repo.list_customers_with_previous_bookings(db)
        drafts = [_customer_draft(customer, source_type=audience_type) for customer in customers]
        return _unique_drafts([draft for draft in drafts if draft is not None])

    if audience_type == CampaignAudienceType.CUSTOMERS_INACTIVE_FOR_DAYS.value:
        filters = getattr(campaign, "audience_filters", None) or {}
        inactive_days = _parse_positive_days(filters)
        customers = await customer_repo.list_customers_inactive_for_days(
            db,
            inactive_days,
            now=datetime.now(timezone.utc),
        )
        drafts = [_customer_draft(customer, source_type=audience_type) for customer in customers]
        return _unique_drafts([draft for draft in drafts if draft is not None])

    if audience_type == CampaignAudienceType.UPLOADED_PHONE_LIST.value:
        phones = _uploaded_phones(campaign)
        drafts = [
            AudienceRecipientDraft(
                phone=phone,
                display_name=phone,
                customer_id=None,
                source_type="upload",
            )
            for phone in phones
        ]
        return _unique_drafts(drafts)

    raise ValueError(f"Unsupported campaign audience type: {audience_type}")
