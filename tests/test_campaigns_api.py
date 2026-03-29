from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import uuid

import pytest
from pydantic import ValidationError

from app.models.campaign import CampaignAudienceType, CampaignDiscountType, CampaignRunStatus, CampaignStatus
from app.models.campaign_recipient import CampaignDeliveryStatus
from app.schemas.campaign import (
    CampaignCreate,
    CampaignPerformance,
    CampaignPerformanceSourceComparison,
    CampaignRead,
    CampaignRecipientRead,
    CampaignSendLogRead,
    CampaignUpdate,
)


def _service_id() -> uuid.UUID:
    return uuid.uuid4()


def test_campaign_create_requires_allowed_services() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(code="diwali-hydra", name="Diwali Hydra")


def test_campaign_create_rejects_invalid_percent_discount() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="diwali-hydra",
            name="Diwali Hydra",
            allowed_service_ids=[_service_id()],
            discount_type=CampaignDiscountType.PERCENT,
            discount_value=Decimal("101"),
        )


def test_campaign_create_rejects_discount_value_for_none() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="diwali-hydra",
            name="Diwali Hydra",
            allowed_service_ids=[_service_id()],
            discount_type=CampaignDiscountType.NONE,
            discount_value=Decimal("10"),
        )


def test_campaign_create_rejects_negative_flat_discount() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="diwali-hydra",
            name="Diwali Hydra",
            allowed_service_ids=[_service_id()],
            discount_type=CampaignDiscountType.FLAT,
            discount_value=Decimal("-1"),
        )


def test_campaign_create_rejects_mixed_naive_and_aware_dates() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="diwali-hydra",
            name="Diwali Hydra",
            allowed_service_ids=[_service_id()],
            discount_type=CampaignDiscountType.NONE,
            valid_from=datetime(2026, 3, 1),
            valid_to=datetime(2026, 3, 31, tzinfo=timezone.utc),
        )


def test_campaign_create_rejects_non_serializable_audience_filters() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="inactive-winback",
            name="Inactive Winback",
            allowed_service_ids=[_service_id()],
            discount_type=CampaignDiscountType.NONE,
            audience_filters={"bad": object()},
        )


def test_campaign_create_rejects_boolean_numeric_inputs() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="diwali-hydra",
            name="Diwali Hydra",
            allowed_service_ids=[_service_id()],
            discount_type=CampaignDiscountType.NONE,
            allowed_weekdays=[True],
        )

    with pytest.raises(ValidationError):
        CampaignUpdate(batch_size=True)

    with pytest.raises(ValidationError):
        CampaignUpdate(batch_delay_seconds=False)


def test_campaign_audience_specific_payload_accepts_filters_dict() -> None:
    payload = CampaignCreate(
        code="inactive-winback",
        name="Inactive Winback",
        allowed_service_ids=[_service_id()],
        discount_type=CampaignDiscountType.NONE,
        audience_type=CampaignAudienceType.CUSTOMERS_INACTIVE_FOR_DAYS,
        audience_filters={"inactive_days": 90},
        message_body="Come back and save",
        button_label="Book now",
    )

    assert payload.audience_type == CampaignAudienceType.CUSTOMERS_INACTIVE_FOR_DAYS
    assert payload.audience_filters == {"inactive_days": 90}


def test_campaign_update_supports_targeting_and_discount_validation() -> None:
    update = CampaignUpdate(
        audience_type=CampaignAudienceType.UPLOADED_PHONE_LIST,
        audience_filters={"phones": ["919999999999"]},
        discount_type=CampaignDiscountType.FLAT,
        discount_value=Decimal("0"),
        allowed_weekdays=[0, 2, 4],
        batch_size=50,
        batch_delay_seconds=10,
    )

    assert update.audience_type == CampaignAudienceType.UPLOADED_PHONE_LIST
    assert update.audience_filters == {"phones": ["919999999999"]}


def test_campaign_detail_schema_exposes_runner_and_funnel_fields() -> None:
    campaign = CampaignRead(
        id=uuid.uuid4(),
        code="diwali-hydra",
        name="Diwali Hydra",
        description="Promo",
        status=CampaignStatus.ACTIVE,
        audience_type=CampaignAudienceType.ALL_CUSTOMERS,
        audience_filters={},
        run_status=CampaignRunStatus.RUNNING,
        allowed_service_ids=[_service_id()],
        allowed_weekdays=[0, 2, 4],
        valid_from=None,
        valid_to=None,
        per_user_booking_limit=1,
        discount_type=CampaignDiscountType.NONE,
        discount_value=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        targeted=12,
        pending=2,
        sent=10,
        delivered=9,
        read=7,
        clicked=1,
        failed=1,
        bookings=4,
        confirmed=2,
        cancelled=1,
        completed=1,
        no_show=0,
        total_service_value=Decimal("2500.00"),
        total_final_value=Decimal("1800.00"),
        source_comparison=[
            CampaignPerformanceSourceComparison(
                source="organic",
                targeted=6,
                pending=1,
                sent=5,
                delivered=5,
                read=3,
                clicked=1,
                failed=0,
                bookings=2,
                confirmed=1,
                cancelled=0,
                completed=1,
                no_show=0,
                total_service_value=Decimal("1200.00"),
                total_final_value=Decimal("900.00"),
            )
        ],
    )

    assert campaign.run_status == CampaignRunStatus.RUNNING
    assert campaign.targeted == 12
    assert campaign.source_comparison[0].source == "organic"


def test_campaign_performance_schema_supports_source_comparison_shape() -> None:
    performance = CampaignPerformance(
        campaign_id=None,
        campaign_code="organic",
        campaign_name="Organic",
        targeted=10,
        pending=2,
        sent=8,
        delivered=7,
        read=6,
        clicked=1,
        failed=1,
        bookings=3,
        confirmed=1,
        cancelled=1,
        completed=1,
        no_show=0,
        total_service_value=Decimal("2000.00"),
        total_final_value=Decimal("1500.00"),
        source_comparison=[
            CampaignPerformanceSourceComparison(
                source="organic",
                targeted=4,
                pending=1,
                sent=3,
                delivered=3,
                read=2,
                clicked=0,
                failed=0,
                bookings=1,
                confirmed=1,
                cancelled=0,
                completed=0,
                no_show=0,
                total_service_value=Decimal("500.00"),
                total_final_value=Decimal("400.00"),
            )
        ],
    )

    assert performance.source_comparison[0].source == "organic"


def test_campaign_recipient_schema_exposes_delivery_state() -> None:
    recipient = CampaignRecipientRead(
        id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        customer_id=None,
        phone="919999999999",
        customer_name="Asha",
        delivery_status=CampaignDeliveryStatus.DELIVERED,
        sent_at=datetime.now(timezone.utc),
        delivered_at=datetime.now(timezone.utc),
        read_at=None,
        clicked_at=None,
        failed_at=None,
        skipped_at=None,
        last_error=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        send_logs=[
            CampaignSendLogRead(
                id=uuid.uuid4(),
                campaign_id=uuid.uuid4(),
                recipient_id=uuid.uuid4(),
                provider_message_id="wamid.test",
                status=CampaignDeliveryStatus.SENT,
                sent_at=datetime.now(timezone.utc),
                delivered_at=None,
                read_at=None,
                clicked_at=None,
                error_message=None,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        ],
    )

    assert recipient.delivery_status == CampaignDeliveryStatus.DELIVERED
    assert recipient.send_logs[0].status == CampaignDeliveryStatus.SENT
