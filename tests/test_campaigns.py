from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
import uuid

import pytest
from fastapi import HTTPException

from app.db.base import Base
from app.models.campaign import CampaignRunStatus, CampaignStatus
from app.services import campaign_service as svc


def test_campaign_tables_and_columns_are_registered() -> None:
    assert "campaigns" in Base.metadata.tables
    assert {"campaign_recipients", "campaign_send_logs"}.issubset(Base.metadata.tables)

    campaign_columns = set(Base.metadata.tables["campaigns"].c.keys())

    assert {
        "audience_type",
        "audience_filters",
        "message_body",
        "message_footer",
        "button_label",
        "image_path",
        "image_media_id",
        "batch_size",
        "batch_delay_seconds",
        "started_at",
        "completed_at",
        "failed_at",
        "last_error",
    }.issubset(campaign_columns)


def test_campaign_status_enums_preserve_legacy_and_runner_values() -> None:
    assert CampaignStatus.ACTIVE.value == "active"
    assert CampaignStatus.EXPIRED.value == "expired"
    assert CampaignStatus.PAUSED.value == "paused"
    assert CampaignRunStatus.DRAFT.value == "draft"
    assert CampaignRunStatus.RUNNING.value == "running"
    assert CampaignRunStatus.PAUSED.value == "paused"
    assert CampaignRunStatus.COMPLETED.value == "completed"
    assert CampaignRunStatus.FAILED.value == "failed"


def test_parse_campaign_button_id_extracts_code() -> None:
    assert svc.parse_campaign_button_id("campaign_book:diwali-hydra-50-sun") == "diwali-hydra-50-sun"
    assert svc.parse_campaign_button_id("book_appointment") is None


def test_campaign_service_and_slot_eligibility_respect_rules() -> None:
    hydra_service_id = uuid.uuid4()
    campaign = SimpleNamespace(
        allowed_service_ids=[str(hydra_service_id)],
        allowed_weekdays=[6],
        valid_from=datetime(2026, 3, 1, tzinfo=timezone.utc),
        valid_to=datetime(2026, 3, 31, 23, 59, tzinfo=timezone.utc),
    )

    sunday_slot = datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc)
    monday_slot = datetime(2026, 3, 30, 10, 0, tzinfo=timezone.utc)

    assert svc.is_service_eligible(campaign, hydra_service_id) is True
    assert svc.is_service_eligible(campaign, uuid.uuid4()) is False
    assert svc.is_slot_eligible(campaign, sunday_slot) is True
    assert svc.is_slot_eligible(campaign, monday_slot) is False


def test_build_booking_snapshot_is_organic_after_organic_restart() -> None:
    campaign = SimpleNamespace(
        id=uuid.uuid4(),
        code="diwali-hydra-50-sun",
        name="Diwali Hydra 50",
        discount_type="percent",
        discount_value=50,
    )

    organic_session = SimpleNamespace(active_journey_type="organic", active_campaign_id=None)
    organic_snapshot = svc.build_booking_snapshot(organic_session, None)

    assert organic_snapshot == {
        "campaign_id": None,
        "campaign_code_snapshot": None,
        "campaign_name_snapshot": None,
        "discount_type_snapshot": None,
        "discount_value_snapshot": None,
    }

    campaign_session = SimpleNamespace(active_journey_type="campaign", active_campaign_id=campaign.id)
    campaign_snapshot = svc.build_booking_snapshot(campaign_session, campaign)

    assert campaign_snapshot == {
        "campaign_id": campaign.id,
        "campaign_code_snapshot": "diwali-hydra-50-sun",
        "campaign_name_snapshot": "Diwali Hydra 50",
        "discount_type_snapshot": "percent",
        "discount_value_snapshot": 50,
    }


def test_calculate_final_cost_applies_percent_and_flat_discounts() -> None:
    percent_campaign = SimpleNamespace(discount_type="percent", discount_value=Decimal("50.00"))
    flat_campaign = SimpleNamespace(discount_type="flat", discount_value=Decimal("300.00"))
    no_discount_campaign = SimpleNamespace(discount_type="none", discount_value=None)

    assert svc.calculate_final_cost(Decimal("2000.00"), percent_campaign) == Decimal("1000.00")
    assert svc.calculate_final_cost(Decimal("2000.00"), flat_campaign) == Decimal("1700.00")
    assert svc.calculate_final_cost(Decimal("2000.00"), no_discount_campaign) == Decimal("2000.00")
    assert svc.calculate_final_cost(Decimal("200.00"), flat_campaign) == Decimal("0.00")


def test_ensure_booking_limit_blocks_when_limit_reached() -> None:
    campaign = SimpleNamespace(per_user_booking_limit=1, name="Diwali Hydra 50")

    with pytest.raises(HTTPException) as exc:
        svc.ensure_booking_limit(campaign, existing_count=1)

    assert exc.value.status_code == 409


def test_is_booking_limit_reached_flags_repeat_redemption() -> None:
    campaign = SimpleNamespace(per_user_booking_limit=1)

    assert svc.is_booking_limit_reached(campaign, existing_count=1) is True
    assert svc.is_booking_limit_reached(campaign, existing_count=0) is False


@pytest.mark.asyncio
async def test_start_organic_journey_clears_existing_campaign_context(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []

    async def fake_reset_session(_db, user_phone: str):
        calls.append({"type": "reset", "user_phone": user_phone})
        return SimpleNamespace()

    async def fake_mark_journey(_db, user_phone: str, *, journey_type: str, campaign_id, entry_point: str, entry_message_id):
        calls.append(
            {
                "type": "journey",
                "user_phone": user_phone,
                "journey_type": journey_type,
                "campaign_id": campaign_id,
                "entry_point": entry_point,
                "entry_message_id": entry_message_id,
            }
        )
        return SimpleNamespace(active_journey_type=journey_type, active_campaign_id=campaign_id)

    monkeypatch.setattr(svc.sess_repo, "reset_session", fake_reset_session)
    monkeypatch.setattr(svc.sess_repo, "mark_journey", fake_mark_journey)

    session = await svc.start_organic_journey(
        db=object(),
        user_phone="919999999999",
        entry_point="button_organic",
        entry_message_id="wamid.abc",
    )

    assert session.active_journey_type == "organic"
    assert session.active_campaign_id is None
    assert calls == [
        {"type": "reset", "user_phone": "919999999999"},
        {
            "type": "journey",
            "user_phone": "919999999999",
            "journey_type": "organic",
            "campaign_id": None,
            "entry_point": "button_organic",
            "entry_message_id": "wamid.abc",
        },
    ]
