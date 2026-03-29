from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
import uuid

import pytest
from fastapi import HTTPException

from app.db.base import Base
from app.models.campaign import CampaignRunStatus, CampaignStatus
from app.models.campaign_recipient import CampaignDeliveryStatus
from app.models.user_session import SessionStep
from app.repositories import campaign_repository as campaign_repo
from app.services import booking_flow_service as booking_flow_svc
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
async def test_count_customer_campaign_bookings_normalizes_formatted_phone_input() -> None:
    captured: dict[str, str] = {}

    class FakeResult:
        def scalar_one(self):
            return 2

    class FakeDB:
        async def execute(self, statement):
            captured["sql"] = str(statement.compile(compile_kwargs={"literal_binds": True}))
            return FakeResult()

    count = await campaign_repo.count_customer_campaign_bookings(
        FakeDB(),
        campaign_id=uuid.uuid4(),
        user_phone="+91 (999) 999-9999",
    )

    assert count == 2
    assert "919999999999" in captured["sql"]
    assert "+91 (999) 999-9999" not in captured["sql"]


@pytest.mark.asyncio
async def test_mark_campaign_recipient_clicked_updates_status_and_clicked_at(monkeypatch: pytest.MonkeyPatch) -> None:
    recipient = SimpleNamespace(
        id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        phone="919999999999",
        delivery_status=CampaignDeliveryStatus.SENT,
        clicked_at=None,
        last_error=None,
    )
    calls: list[dict[str, object]] = []

    class FakeResult:
        def scalar_one_or_none(self):
            return recipient

    class FakeDB:
        async def execute(self, _statement):
            return FakeResult()

        async def flush(self):
            calls.append({"type": "flush"})

    async def fake_update_recipient_status(db, *, recipient, delivery_status, provider_message_id=None, error_message=None):
        calls.append(
            {
                "type": "update",
                "recipient": recipient,
                "delivery_status": delivery_status,
                "provider_message_id": provider_message_id,
                "error_message": error_message,
            }
        )
        recipient.delivery_status = delivery_status
        recipient.clicked_at = datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc)
        return recipient

    monkeypatch.setattr(campaign_repo, "update_recipient_status", fake_update_recipient_status)

    updated = await campaign_repo.mark_campaign_recipient_clicked(
        FakeDB(),
        campaign_id=recipient.campaign_id,
        user_phone=" +91 99999 99999 ",
    )

    assert updated is recipient
    assert calls == [
        {
            "type": "update",
            "recipient": recipient,
            "delivery_status": CampaignDeliveryStatus.CLICKED,
            "provider_message_id": None,
            "error_message": None,
        }
    ]


@pytest.mark.asyncio
async def test_mark_campaign_recipient_clicked_returns_none_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResult:
        def scalar_one_or_none(self):
            return None

    class FakeDB:
        async def execute(self, _statement):
            return FakeResult()

    async def guard_update_recipient_status(*args, **kwargs):  # pragma: no cover - should not run
        raise AssertionError("missing recipient should not be updated")

    monkeypatch.setattr(campaign_repo, "update_recipient_status", guard_update_recipient_status)

    updated = await campaign_repo.mark_campaign_recipient_clicked(
        FakeDB(),
        campaign_id=uuid.uuid4(),
        user_phone="919999999999",
    )

    assert updated is None


@pytest.mark.asyncio
async def test_mark_campaign_recipient_clicked_uses_normalized_phone_query_path() -> None:
    recipient = SimpleNamespace(
        id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        phone="919999999999",
        delivery_status=CampaignDeliveryStatus.SENT,
        clicked_at=None,
        last_error=None,
    )
    captured: dict[str, str] = {}

    class FakeResult:
        def scalar_one_or_none(self):
            return recipient

    class FakeDB:
        async def execute(self, statement):
            captured["sql"] = str(statement.compile(compile_kwargs={"literal_binds": True}))
            return FakeResult()

        async def flush(self):
            captured["flushed"] = "yes"

    updated = await campaign_repo.mark_campaign_recipient_clicked(
        FakeDB(),
        campaign_id=recipient.campaign_id,
        user_phone="+91 (999) 999-9999",
    )

    assert updated is recipient
    assert captured["sql"].count("919999999999") >= 1
    assert "+91 (999) 999-9999" not in captured["sql"]
    assert recipient.delivery_status == CampaignDeliveryStatus.CLICKED
    assert recipient.clicked_at is not None
    assert captured["flushed"] == "yes"


@pytest.mark.asyncio
async def test_mark_campaign_recipient_clicked_prefers_latest_matching_row_for_same_campaign_and_phone() -> None:
    campaign_id = uuid.uuid4()
    older = SimpleNamespace(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        phone="919999999999",
        delivery_status=CampaignDeliveryStatus.SENT,
        clicked_at=None,
        last_error=None,
    )
    newer = SimpleNamespace(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        phone="+919999999999",
        delivery_status=CampaignDeliveryStatus.SENT,
        clicked_at=None,
        last_error=None,
    )
    captured: dict[str, str] = {}

    class FakeResult:
        def scalar_one_or_none(self):
            return newer

    class FakeDB:
        async def execute(self, statement):
            captured["sql"] = str(statement.compile(compile_kwargs={"literal_binds": True}))
            return FakeResult()

        async def flush(self):
            captured["flushed"] = "yes"

    updated = await campaign_repo.mark_campaign_recipient_clicked(
        FakeDB(),
        campaign_id=campaign_id,
        user_phone=" +91 99999 99999 ",
    )

    assert updated is newer
    assert "campaign_recipients.campaign_id" in captured["sql"]
    assert "ORDER BY campaign_recipients.created_at DESC" in captured["sql"]
    assert "LIMIT 1" in captured["sql"]
    assert older.clicked_at is None
    assert newer.clicked_at is not None
    assert captured["flushed"] == "yes"


@pytest.mark.asyncio
async def test_campaign_button_failure_does_not_mark_message_processed(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[dict[str, object]] = []
    payload = {"messages": [{"id": "wamid.campaign"}]}
    campaign = SimpleNamespace(id=uuid.uuid4(), code="diwali-hydra-50-sun", name="Diwali Hydra 50", status=CampaignStatus.ACTIVE)

    async def fake_get_or_create_session(_db, sender):
        return SimpleNamespace(
            current_step=SessionStep.START,
            updated_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
            selected_service_id=None,
            selected_appointment_id=None,
        )

    async def fake_get_or_create_by_phone(_db, phone, whatsapp_name=None):
        return SimpleNamespace(name=None), False

    async def fake_start_campaign_journey(_db, user_phone, *, campaign, entry_point, entry_message_id):
        events.append(
            {
                "type": "journey",
                "user_phone": user_phone,
                "campaign_id": campaign.id,
                "entry_point": entry_point,
                "entry_message_id": entry_message_id,
            }
        )
        raise RuntimeError("journey setup failed")

    async def fake_mark_clicked(_db, *, campaign_id, user_phone):
        events.append({"type": "click", "campaign_id": campaign_id, "user_phone": user_phone})
        return SimpleNamespace()

    async def fake_count_bookings(*args, **kwargs):
        return 0

    async def fake_get_campaign_by_code(_db, code):
        assert code == campaign.code
        return campaign

    async def fake_handle_greeting(*args, **kwargs):  # pragma: no cover - should not run
        events.append({"type": "greeting"})

    monkeypatch.setattr(booking_flow_svc, "extract_message", lambda payload: {"interactive": {"button_reply": {"id": "campaign_book:diwali-hydra-50-sun"}}})
    monkeypatch.setattr(booking_flow_svc, "extract_sender_phone", lambda payload: "919999999999")
    monkeypatch.setattr(booking_flow_svc, "extract_whatsapp_profile_name", lambda payload: None)
    monkeypatch.setattr(booking_flow_svc, "get_message_id", lambda message: "wamid.campaign")
    monkeypatch.setattr(booking_flow_svc, "get_message_type", lambda message: booking_flow_svc.MessageType.BUTTON_REPLY)
    monkeypatch.setattr(booking_flow_svc, "get_button_reply_id", lambda message: "campaign_book:diwali-hydra-50-sun")
    monkeypatch.setattr(booking_flow_svc.sess_repo, "get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr(booking_flow_svc.customer_repo, "get_or_create_by_phone", fake_get_or_create_by_phone)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "get_campaign_by_code", fake_get_campaign_by_code)
    monkeypatch.setattr(booking_flow_svc.campaign_service, "is_campaign_active", lambda active_campaign: True)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "count_customer_campaign_bookings", fake_count_bookings)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "mark_campaign_recipient_clicked", fake_mark_clicked)
    monkeypatch.setattr(booking_flow_svc.campaign_service, "start_campaign_journey", fake_start_campaign_journey)
    monkeypatch.setattr(booking_flow_svc, "_handle_greeting", fake_handle_greeting)

    class FakeSessionService:
        async def is_duplicate_message(self, message_id):
            return False

        async def mark_message_processed(self, message_id):
            events.append({"type": "processed", "message_id": message_id})

    class FakeWhatsAppClient:
        async def send_text(self, *args, **kwargs):
            raise AssertionError("greeting is stubbed")

    class FakeDB:
        async def commit(self):
            events.append({"type": "commit"})

        async def rollback(self):
            events.append({"type": "rollback"})

    with pytest.raises(RuntimeError, match="journey setup failed"):
        await booking_flow_svc._process_message(payload, FakeDB(), FakeSessionService(), FakeWhatsAppClient())

    assert events == [
        {"type": "click", "campaign_id": campaign.id, "user_phone": "919999999999"},
        {
            "type": "journey",
            "user_phone": "919999999999",
            "campaign_id": campaign.id,
            "entry_point": "button_campaign",
            "entry_message_id": "wamid.campaign",
        },
    ]


@pytest.mark.asyncio
async def test_book_appointment_failure_does_not_mark_message_processed(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[dict[str, object]] = []
    payload = {"messages": [{"id": "wamid.book"}]}

    async def fake_get_or_create_session(_db, sender):
        return SimpleNamespace(
            current_step=SessionStep.START,
            updated_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
            selected_service_id=None,
            selected_appointment_id=None,
        )

    async def fake_get_or_create_by_phone(_db, phone, whatsapp_name=None):
        return SimpleNamespace(name=None), False

    async def fake_start_organic_journey(_db, user_phone, *, entry_point, entry_message_id):
        events.append(
            {
                "type": "journey",
                "user_phone": user_phone,
                "entry_point": entry_point,
                "entry_message_id": entry_message_id,
            }
        )
        return SimpleNamespace()

    async def fake_handle_greeting(*args, **kwargs):
        raise RuntimeError("greeting failed")

    monkeypatch.setattr(booking_flow_svc, "extract_message", lambda payload: {"interactive": {"button_reply": {"id": "book_appointment"}}})
    monkeypatch.setattr(booking_flow_svc, "extract_sender_phone", lambda payload: "919999999999")
    monkeypatch.setattr(booking_flow_svc, "extract_whatsapp_profile_name", lambda payload: None)
    monkeypatch.setattr(booking_flow_svc, "get_message_id", lambda message: "wamid.book")
    monkeypatch.setattr(booking_flow_svc, "get_message_type", lambda message: booking_flow_svc.MessageType.BUTTON_REPLY)
    monkeypatch.setattr(booking_flow_svc, "get_button_reply_id", lambda message: "book_appointment")
    monkeypatch.setattr(booking_flow_svc.sess_repo, "get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr(booking_flow_svc.customer_repo, "get_or_create_by_phone", fake_get_or_create_by_phone)
    monkeypatch.setattr(booking_flow_svc.campaign_service, "start_organic_journey", fake_start_organic_journey)
    monkeypatch.setattr(booking_flow_svc, "_handle_greeting", fake_handle_greeting)

    class FakeSessionService:
        async def is_duplicate_message(self, message_id):
            return False

        async def mark_message_processed(self, message_id):
            events.append({"type": "processed", "message_id": message_id})

    class FakeWhatsAppClient:
        async def send_text(self, *args, **kwargs):
            raise AssertionError("send_text should not be used before the failure")

    class FakeDB:
        async def commit(self):
            events.append({"type": "commit"})

        async def rollback(self):
            events.append({"type": "rollback"})

    with pytest.raises(RuntimeError, match="greeting failed"):
        await booking_flow_svc._process_message(payload, FakeDB(), FakeSessionService(), FakeWhatsAppClient())

    assert events == [
        {"type": "journey", "user_phone": "919999999999", "entry_point": "button_organic", "entry_message_id": "wamid.book"},
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("button_id", "raiser_name"),
    [
        ("my_appointments", "_handle_manage_menu"),
        ("update_name", "_handle_update_name_prompt"),
    ],
)
async def test_other_quick_actions_do_not_mark_processed_on_failure(
    monkeypatch: pytest.MonkeyPatch,
    button_id: str,
    raiser_name: str,
) -> None:
    events: list[dict[str, object]] = []
    payload = {"messages": [{"id": f"wamid.{button_id}"}]}

    async def fake_get_or_create_session(_db, sender):
        return SimpleNamespace(
            current_step=SessionStep.START,
            updated_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
            selected_service_id=None,
            selected_appointment_id=None,
        )

    async def fake_get_or_create_by_phone(_db, phone, whatsapp_name=None):
        return SimpleNamespace(name=None), False

    async def fake_raiser(*args, **kwargs):
        raise RuntimeError(f"{button_id} failed")

    monkeypatch.setattr(booking_flow_svc, "extract_message", lambda payload: {"interactive": {"button_reply": {"id": button_id}}})
    monkeypatch.setattr(booking_flow_svc, "extract_sender_phone", lambda payload: "919999999999")
    monkeypatch.setattr(booking_flow_svc, "extract_whatsapp_profile_name", lambda payload: None)
    monkeypatch.setattr(booking_flow_svc, "get_message_id", lambda message: f"wamid.{button_id}")
    monkeypatch.setattr(booking_flow_svc, "get_message_type", lambda message: booking_flow_svc.MessageType.BUTTON_REPLY)
    monkeypatch.setattr(booking_flow_svc, "get_button_reply_id", lambda message: button_id)
    monkeypatch.setattr(booking_flow_svc.sess_repo, "get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr(booking_flow_svc.customer_repo, "get_or_create_by_phone", fake_get_or_create_by_phone)
    monkeypatch.setattr(booking_flow_svc, raiser_name, fake_raiser)

    class FakeSessionService:
        async def is_duplicate_message(self, message_id):
            return False

        async def mark_message_processed(self, message_id):
            events.append({"type": "processed", "message_id": message_id})

    class FakeWhatsAppClient:
        async def send_text(self, *args, **kwargs):
            raise AssertionError("send_text should not be used before the failure")

        async def send_button_message(self, *args, **kwargs):
            raise AssertionError("send_button_message should not be used before the failure")

        async def send_list_message(self, *args, **kwargs):
            raise AssertionError("send_list_message should not be used before the failure")

    class FakeDB:
        async def commit(self):
            events.append({"type": "commit"})

        async def rollback(self):
            events.append({"type": "rollback"})

    with pytest.raises(RuntimeError, match=f"{button_id} failed"):
        await booking_flow_svc._process_message(payload, FakeDB(), FakeSessionService(), FakeWhatsAppClient())

    assert events == []


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


@pytest.mark.asyncio
async def test_campaign_button_click_stamps_recipient_before_campaign_journey(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[dict[str, object]] = []
    payload = {"messages": [{"id": "wamid.campaign"}]}
    campaign = SimpleNamespace(id=uuid.uuid4(), code="diwali-hydra-50-sun", name="Diwali Hydra 50", status=CampaignStatus.ACTIVE)

    async def fake_get_or_create_session(_db, sender):
        return SimpleNamespace(
            current_step=SessionStep.START,
            updated_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
            selected_service_id=None,
            selected_appointment_id=None,
        )

    async def fake_get_or_create_by_phone(_db, phone, whatsapp_name=None):
        return SimpleNamespace(name=None), False

    async def fake_start_campaign_journey(_db, user_phone, *, campaign, entry_point, entry_message_id):
        events.append(
            {
                "type": "journey",
                "user_phone": user_phone,
                "campaign_id": campaign.id,
                "entry_point": entry_point,
                "entry_message_id": entry_message_id,
            }
        )
        return SimpleNamespace()

    async def fake_mark_clicked(_db, *, campaign_id, user_phone):
        events.append({"type": "click", "campaign_id": campaign_id, "user_phone": user_phone})
        return SimpleNamespace()

    async def fake_count_bookings(*args, **kwargs):
        return 0

    async def fake_get_campaign_by_code(_db, code):
        assert code == campaign.code
        return campaign

    async def fake_handle_greeting(*args, **kwargs):
        events.append({"type": "greeting"})

    monkeypatch.setattr(booking_flow_svc, "extract_message", lambda payload: {"interactive": {"button_reply": {"id": "campaign_book:diwali-hydra-50-sun"}}})
    monkeypatch.setattr(booking_flow_svc, "extract_sender_phone", lambda payload: "919999999999")
    monkeypatch.setattr(booking_flow_svc, "extract_whatsapp_profile_name", lambda payload: None)
    monkeypatch.setattr(booking_flow_svc, "get_message_id", lambda message: "wamid.campaign")
    monkeypatch.setattr(booking_flow_svc, "get_message_type", lambda message: booking_flow_svc.MessageType.BUTTON_REPLY)
    monkeypatch.setattr(booking_flow_svc, "get_button_reply_id", lambda message: "campaign_book:diwali-hydra-50-sun")
    monkeypatch.setattr(booking_flow_svc.sess_repo, "get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr(booking_flow_svc.customer_repo, "get_or_create_by_phone", fake_get_or_create_by_phone)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "get_campaign_by_code", fake_get_campaign_by_code)
    monkeypatch.setattr(booking_flow_svc.campaign_service, "is_campaign_active", lambda active_campaign: True)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "count_customer_campaign_bookings", fake_count_bookings)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "mark_campaign_recipient_clicked", fake_mark_clicked)
    monkeypatch.setattr(booking_flow_svc.campaign_service, "start_campaign_journey", fake_start_campaign_journey)
    monkeypatch.setattr(booking_flow_svc, "_handle_greeting", fake_handle_greeting)

    class FakeSessionService:
        async def is_duplicate_message(self, message_id):
            return False

        async def mark_message_processed(self, message_id):
            events.append({"type": "processed", "message_id": message_id})

    class FakeWhatsAppClient:
        async def send_text(self, *args, **kwargs):
            raise AssertionError("greeting is stubbed")

    async def fake_commit():
        events.append({"type": "commit"})

    class FakeDB:
        async def commit(self):
            await fake_commit()

        async def rollback(self):
            events.append({"type": "rollback"})

    await booking_flow_svc._process_message(payload, FakeDB(), FakeSessionService(), FakeWhatsAppClient())

    assert events == [
        {"type": "click", "campaign_id": campaign.id, "user_phone": "919999999999"},
        {
            "type": "journey",
            "user_phone": "919999999999",
            "campaign_id": campaign.id,
            "entry_point": "button_campaign",
            "entry_message_id": "wamid.campaign",
        },
        {"type": "greeting"},
        {"type": "processed", "message_id": "wamid.campaign"},
    ]


@pytest.mark.asyncio
async def test_campaign_button_click_keeps_flow_running_when_recipient_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[dict[str, object]] = []
    payload = {"messages": [{"id": "wamid.campaign"}]}
    campaign = SimpleNamespace(id=uuid.uuid4(), code="diwali-hydra-50-sun", name="Diwali Hydra 50", status=CampaignStatus.ACTIVE)

    monkeypatch.setattr(booking_flow_svc, "extract_message", lambda payload: {"interactive": {"button_reply": {"id": "campaign_book:diwali-hydra-50-sun"}}})
    monkeypatch.setattr(booking_flow_svc, "extract_sender_phone", lambda payload: "919999999999")
    monkeypatch.setattr(booking_flow_svc, "extract_whatsapp_profile_name", lambda payload: None)
    monkeypatch.setattr(booking_flow_svc, "get_message_id", lambda message: "wamid.campaign")
    monkeypatch.setattr(booking_flow_svc, "get_message_type", lambda message: booking_flow_svc.MessageType.BUTTON_REPLY)
    monkeypatch.setattr(booking_flow_svc, "get_button_reply_id", lambda message: "campaign_book:diwali-hydra-50-sun")
    async def fake_get_or_create_session(_db, sender):
        return SimpleNamespace(
            current_step=SessionStep.START,
            updated_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
            selected_service_id=None,
            selected_appointment_id=None,
        )

    async def fake_get_or_create_by_phone(_db, phone, whatsapp_name=None):
        return SimpleNamespace(name=None), False

    async def fake_get_campaign_by_code(_db, code):
        assert code == campaign.code
        return campaign

    async def fake_count_bookings(*args, **kwargs):
        return 0

    async def fake_handle_greeting(*args, **kwargs):
        events.append({"type": "greeting"})

    monkeypatch.setattr(booking_flow_svc.sess_repo, "get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr(booking_flow_svc.customer_repo, "get_or_create_by_phone", fake_get_or_create_by_phone)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "get_campaign_by_code", fake_get_campaign_by_code)
    monkeypatch.setattr(booking_flow_svc.campaign_service, "is_campaign_active", lambda active_campaign: True)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "count_customer_campaign_bookings", fake_count_bookings)

    async def fake_mark_clicked(_db, *, campaign_id, user_phone):
        events.append({"type": "click", "campaign_id": campaign_id, "user_phone": user_phone})
        return None

    async def fake_start_campaign_journey(_db, user_phone, *, campaign, entry_point, entry_message_id):
        events.append(
            {
                "type": "journey",
                "user_phone": user_phone,
                "campaign_id": campaign.id,
                "entry_point": entry_point,
                "entry_message_id": entry_message_id,
            }
        )
        return SimpleNamespace()

    monkeypatch.setattr(booking_flow_svc.campaign_repo, "mark_campaign_recipient_clicked", fake_mark_clicked)
    monkeypatch.setattr(booking_flow_svc.campaign_service, "start_campaign_journey", fake_start_campaign_journey)
    monkeypatch.setattr(booking_flow_svc, "_handle_greeting", fake_handle_greeting)

    class FakeSessionService:
        async def is_duplicate_message(self, message_id):
            return False

        async def mark_message_processed(self, message_id):
            events.append({"type": "processed", "message_id": message_id})

    class FakeWhatsAppClient:
        async def send_text(self, *args, **kwargs):
            raise AssertionError("greeting is stubbed")

    class FakeDB:
        async def commit(self):
            events.append({"type": "commit"})

        async def rollback(self):
            events.append({"type": "rollback"})

    await booking_flow_svc._process_message(payload, FakeDB(), FakeSessionService(), FakeWhatsAppClient())

    assert events == [
        {"type": "click", "campaign_id": campaign.id, "user_phone": "919999999999"},
        {
            "type": "journey",
            "user_phone": "919999999999",
            "campaign_id": campaign.id,
            "entry_point": "button_campaign",
            "entry_message_id": "wamid.campaign",
        },
        {"type": "greeting"},
        {"type": "processed", "message_id": "wamid.campaign"},
    ]


@pytest.mark.asyncio
async def test_organic_button_path_does_not_stamp_campaign_recipient(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[dict[str, object]] = []
    payload = {"messages": [{"id": "wamid.organic"}]}

    monkeypatch.setattr(booking_flow_svc, "extract_message", lambda payload: {"interactive": {"button_reply": {"id": "book_appointment"}}})
    monkeypatch.setattr(booking_flow_svc, "extract_sender_phone", lambda payload: "919999999999")
    monkeypatch.setattr(booking_flow_svc, "extract_whatsapp_profile_name", lambda payload: None)
    monkeypatch.setattr(booking_flow_svc, "get_message_id", lambda message: "wamid.organic")
    monkeypatch.setattr(booking_flow_svc, "get_message_type", lambda message: booking_flow_svc.MessageType.BUTTON_REPLY)
    monkeypatch.setattr(booking_flow_svc, "get_button_reply_id", lambda message: "book_appointment")

    async def fake_start_organic_journey(_db, user_phone, *, entry_point, entry_message_id):
        events.append(
            {
                "type": "journey",
                "user_phone": user_phone,
                "entry_point": entry_point,
                "entry_message_id": entry_message_id,
            }
        )
        return SimpleNamespace()

    async def guard_mark_clicked(*args, **kwargs):  # pragma: no cover - should not run
        raise AssertionError("organic path should not stamp campaign recipients")

    monkeypatch.setattr(booking_flow_svc.campaign_service, "start_organic_journey", fake_start_organic_journey)
    monkeypatch.setattr(booking_flow_svc.campaign_repo, "mark_campaign_recipient_clicked", guard_mark_clicked)

    class FakeSessionService:
        async def is_duplicate_message(self, message_id):
            return False

        async def mark_message_processed(self, message_id):
            events.append({"type": "processed", "message_id": message_id})

    class FakeWhatsAppClient:
        async def send_text(self, *args, **kwargs):
            raise AssertionError("organic greeting is stubbed")

    class FakeDB:
        async def commit(self):
            events.append({"type": "commit"})

        async def rollback(self):
            events.append({"type": "rollback"})

    async def fake_get_or_create_session(_db, sender):
        return SimpleNamespace(
            current_step=SessionStep.START,
            updated_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
            selected_service_id=None,
            selected_appointment_id=None,
        )

    async def fake_handle_greeting(*args, **kwargs):
        events.append({"type": "greeting"})

    async def fake_get_or_create_by_phone(_db, phone, whatsapp_name=None):
        return SimpleNamespace(name=None), False

    monkeypatch.setattr(booking_flow_svc.sess_repo, "get_or_create_session", fake_get_or_create_session)
    monkeypatch.setattr(booking_flow_svc.customer_repo, "get_or_create_by_phone", fake_get_or_create_by_phone)
    monkeypatch.setattr(booking_flow_svc, "_handle_greeting", fake_handle_greeting)

    await booking_flow_svc._process_message(payload, FakeDB(), FakeSessionService(), FakeWhatsAppClient())

    assert events == [
        {
            "type": "journey",
            "user_phone": "919999999999",
            "entry_point": "button_organic",
            "entry_message_id": "wamid.organic",
        },
        {"type": "greeting"},
        {"type": "processed", "message_id": "wamid.organic"},
    ]
