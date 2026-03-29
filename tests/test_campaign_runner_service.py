from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
import uuid

import pytest
from sqlalchemy.dialects import postgresql

from app.api.v1 import campaigns as campaigns_api
from app.db.base import Base  # noqa: F401
from app.models.campaign import CampaignRunStatus, CampaignStatus
from app.models.campaign_recipient import CampaignDeliveryStatus
from app.repositories import campaign_repository as campaign_repo
from app.services import campaign_audience_service as campaign_audience_svc
from app.services import campaign_runner_service as svc


@dataclass
class FakeDB:
    flush_calls: int = 0
    commit_calls: int = 0

    async def flush(self) -> None:
        self.flush_calls += 1

    async def commit(self) -> None:
        self.commit_calls += 1


def _campaign(**overrides):
    now = datetime.now(timezone.utc)
    defaults = {
        "id": uuid.uuid4(),
        "code": "diwali-hydra-50-sun",
        "name": "Diwali Hydra 50",
        "status": CampaignStatus.ACTIVE,
        "message_body": "Hydra facial at 50% off this Sunday.",
        "message_footer": "ORA Clinic",
        "button_label": "Book now",
        "booking_button_id": "campaign_book:diwali-hydra-50-sun",
        "image_path": None,
        "image_media_id": None,
        "batch_size": 50,
        "batch_delay_seconds": 0,
        "started_at": None,
        "completed_at": None,
        "failed_at": None,
        "last_error": None,
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _recipient(**overrides):
    now = datetime.now(timezone.utc)
    defaults = {
        "id": uuid.uuid4(),
        "campaign_id": uuid.uuid4(),
        "customer_id": None,
        "phone": "919999999999",
        "customer_name": "Asha",
        "delivery_status": CampaignDeliveryStatus.PENDING,
        "sent_at": None,
        "failed_at": None,
        "last_error": None,
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return list(self._items)


class _ExecuteResult:
    def __init__(self, scalar_one_or_none=None, scalars_items=None):
        self._scalar_one_or_none = scalar_one_or_none
        self._scalars_items = scalars_items or []

    def scalar_one_or_none(self):
        return self._scalar_one_or_none

    def scalars(self):
        return _ScalarResult(self._scalars_items)


@pytest.mark.asyncio
async def test_launch_campaign_creates_recipients_marks_running_without_dispatching(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    campaign = _campaign()
    drafts = [
        campaign_audience_svc.AudienceRecipientDraft(
            phone="919999999999",
            display_name="Asha",
            customer_id=uuid.uuid4(),
            source_type="all_customers",
        ),
        campaign_audience_svc.AudienceRecipientDraft(
            phone="918888888888",
            display_name="Ravi",
            customer_id=None,
            source_type="upload",
        ),
    ]
    created_recipients: list[object] = []
    dispatch_calls: list[dict[str, object]] = []

    async def fake_get_campaign_by_id_for_update(_db, campaign_id):
        assert campaign_id == campaign.id
        return campaign

    async def fake_resolve_campaign_audience(_db, resolved_campaign):
        assert resolved_campaign is campaign
        return drafts

    async def fake_bulk_create(_db, *, campaign, drafts):
        recipients = [
            _recipient(
                campaign_id=campaign.id,
                phone=draft.phone,
                customer_name=draft.display_name,
                customer_id=draft.customer_id,
            )
            for draft in drafts
        ]
        created_recipients.extend(recipients)
        return recipients

    async def guard_get_campaign_by_id(*args, **kwargs):  # pragma: no cover - should not run
        raise AssertionError("launch should lock the campaign row before validating")

    monkeypatch.setattr(svc.campaign_repo, "get_campaign_by_id", guard_get_campaign_by_id)
    monkeypatch.setattr(svc.campaign_repo, "get_campaign_by_id_for_update", fake_get_campaign_by_id_for_update)
    monkeypatch.setattr(svc.campaign_audience_svc, "resolve_campaign_audience", fake_resolve_campaign_audience)
    monkeypatch.setattr(svc.campaign_repo, "bulk_create_recipients_from_drafts", fake_bulk_create)

    launched = await svc.launch_campaign(
        db,
        campaign_id=campaign.id,
        whatsapp_client=object(),
    )

    assert launched is campaign
    assert len(created_recipients) == 2
    assert campaign.started_at is not None
    assert campaign.completed_at is None
    assert campaign.failed_at is None
    assert campaign.last_error is None
    assert campaign.status == CampaignStatus.ACTIVE
    assert campaign.run_status == CampaignRunStatus.RUNNING
    assert db.flush_calls == 1
    assert dispatch_calls == []


@pytest.mark.asyncio
async def test_get_campaign_by_id_for_update_uses_row_lock() -> None:
    captured = {}

    class LockingDB:
        async def execute(self, statement):
            captured["sql"] = str(
                statement.compile(
                    dialect=postgresql.dialect(),
                    compile_kwargs={"literal_binds": True},
                )
            )
            return _ExecuteResult()

    await campaign_repo.get_campaign_by_id_for_update(LockingDB(), uuid.uuid4())

    assert "FOR UPDATE" in captured["sql"]


@pytest.mark.asyncio
async def test_list_pending_recipients_uses_skip_locked_selection() -> None:
    captured = {}

    class LockingDB:
        async def execute(self, statement):
            captured["sql"] = str(
                statement.compile(
                    dialect=postgresql.dialect(),
                    compile_kwargs={"literal_binds": True},
                )
            )
            return _ExecuteResult(scalars_items=[])

    await campaign_repo.list_pending_recipients(LockingDB(), campaign_id=uuid.uuid4(), limit=25)

    assert "FOR UPDATE SKIP LOCKED" in captured["sql"]


@pytest.mark.asyncio
async def test_start_campaign_endpoint_commits_before_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    campaign = _campaign(started_at=datetime.now(timezone.utc))
    events: list[str] = []
    detail_payload = {
        "id": str(campaign.id),
        "status": CampaignStatus.ACTIVE.value,
        "run_status": CampaignRunStatus.RUNNING.value,
        "metrics": {"targeted": 2, "pending": 2, "sent": 0, "failed": 0},
    }

    async def fake_launch_campaign(_db, *, campaign_id, whatsapp_client):
        assert _db is db
        assert campaign_id == campaign.id
        assert whatsapp_client == "wa-client"
        events.append("launch")
        return campaign

    async def fake_dispatch_campaign(*, campaign_id, whatsapp_client):
        assert campaign_id == campaign.id
        assert whatsapp_client == "wa-client"
        events.append("dispatch")

    async def fake_get_campaign_detail(_db, *, campaign_id):
        assert _db is db
        assert campaign_id == campaign.id
        events.append("detail")
        return detail_payload

    async def fake_commit() -> None:
        events.append("commit")
        db.commit_calls += 1

    db.commit = fake_commit

    monkeypatch.setattr(campaigns_api.campaign_runner_svc, "launch_campaign", fake_launch_campaign)
    monkeypatch.setattr(campaigns_api.campaign_runner_svc, "dispatch_campaign", fake_dispatch_campaign)
    monkeypatch.setattr(campaigns_api.campaign_repo, "get_campaign_detail", fake_get_campaign_detail)

    result = await campaigns_api.start_campaign(campaign.id, db=db, whatsapp_client="wa-client")

    assert result == detail_payload
    assert events == ["launch", "commit", "dispatch", "detail"]
    assert db.commit_calls == 1


@pytest.mark.asyncio
async def test_process_campaign_batch_marks_recipient_sent_and_writes_send_log(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    campaign = _campaign(image_path=None, image_media_id=None)
    recipient = _recipient(campaign_id=campaign.id)
    send_logs: list[dict[str, object]] = []

    async def fake_list_pending_recipients(_db, *, campaign_id, limit):
        assert campaign_id == campaign.id
        assert limit == campaign.batch_size
        return [recipient]

    async def fake_update_recipient_status(_db, *, recipient, delivery_status, provider_message_id=None, error_message=None):
        recipient.delivery_status = delivery_status
        recipient.last_error = error_message
        recipient.provider_message_id = provider_message_id
        if delivery_status == CampaignDeliveryStatus.SENT:
            recipient.sent_at = datetime.now(timezone.utc)
        return recipient

    async def fake_create_send_log(_db, **kwargs):
        send_logs.append(kwargs)
        return SimpleNamespace(**kwargs)

    class FakeWhatsAppClient:
        async def send_button_message(self, *, to, body, buttons):
            assert to == recipient.phone
            assert body == campaign.message_body
            assert buttons == [{"id": campaign.booking_button_id, "title": campaign.button_label}]
            return {"messages": [{"id": "wamid.success"}]}

    monkeypatch.setattr(svc.campaign_repo, "list_pending_recipients", fake_list_pending_recipients)
    monkeypatch.setattr(svc.campaign_repo, "update_recipient_status", fake_update_recipient_status)
    monkeypatch.setattr(svc.campaign_repo, "create_send_log", fake_create_send_log)

    processed = await svc.process_campaign_batch(db, campaign, whatsapp_client=FakeWhatsAppClient())

    assert processed == 1
    assert recipient.delivery_status == CampaignDeliveryStatus.SENT
    assert recipient.sent_at is not None
    assert send_logs[0]["status"] == CampaignDeliveryStatus.SENT
    assert send_logs[0]["provider_message_id"] == "wamid.success"
    assert send_logs[0]["error_message"] is None


@pytest.mark.asyncio
async def test_process_campaign_batch_marks_recipient_failed_and_logs_error(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    campaign = _campaign()
    recipient = _recipient(campaign_id=campaign.id)
    send_logs: list[dict[str, object]] = []

    async def fake_list_pending_recipients(_db, *, campaign_id, limit):
        assert campaign_id == campaign.id
        assert limit == campaign.batch_size
        return [recipient]

    async def fake_update_recipient_status(_db, *, recipient, delivery_status, provider_message_id=None, error_message=None):
        recipient.delivery_status = delivery_status
        recipient.last_error = error_message
        if delivery_status == CampaignDeliveryStatus.FAILED:
            recipient.failed_at = datetime.now(timezone.utc)
        return recipient

    async def fake_create_send_log(_db, **kwargs):
        send_logs.append(kwargs)
        return SimpleNamespace(**kwargs)

    class FakeWhatsAppClient:
        async def send_button_message(self, *, to, body, buttons):
            raise RuntimeError(f"provider rejected {to}")

    monkeypatch.setattr(svc.campaign_repo, "list_pending_recipients", fake_list_pending_recipients)
    monkeypatch.setattr(svc.campaign_repo, "update_recipient_status", fake_update_recipient_status)
    monkeypatch.setattr(svc.campaign_repo, "create_send_log", fake_create_send_log)

    processed = await svc.process_campaign_batch(db, campaign, whatsapp_client=FakeWhatsAppClient())

    assert processed == 1
    assert recipient.delivery_status == CampaignDeliveryStatus.FAILED
    assert recipient.failed_at is not None
    assert recipient.last_error == "provider rejected 919999999999"
    assert send_logs[0]["status"] == CampaignDeliveryStatus.FAILED
    assert send_logs[0]["error_message"] == "provider rejected 919999999999"


@pytest.mark.asyncio
async def test_process_campaign_batch_reuses_existing_image_media_id(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    campaign = _campaign(image_path="uploads/campaigns/hero.png", image_media_id="media-123")
    recipient = _recipient(campaign_id=campaign.id)
    image_calls: list[dict[str, object]] = []

    async def fake_list_pending_recipients(_db, *, campaign_id, limit):
        return [recipient]

    async def fake_update_recipient_status(_db, *, recipient, delivery_status, provider_message_id=None, error_message=None):
        recipient.delivery_status = delivery_status
        return recipient

    async def fake_create_send_log(_db, **kwargs):
        return SimpleNamespace(**kwargs)

    async def fake_ensure_campaign_image_media_id(*args, **kwargs):  # pragma: no cover - should not run
        raise AssertionError("existing image media id should be reused")

    class FakeWhatsAppClient:
        async def send_image_button_message(self, *, to, body, media_id, buttons, footer=None):
            image_calls.append(
                {
                    "to": to,
                    "body": body,
                    "media_id": media_id,
                    "buttons": buttons,
                    "footer": footer,
                }
            )
            return {"messages": [{"id": "wamid.image"}]}

    monkeypatch.setattr(svc.campaign_repo, "list_pending_recipients", fake_list_pending_recipients)
    monkeypatch.setattr(svc.campaign_repo, "update_recipient_status", fake_update_recipient_status)
    monkeypatch.setattr(svc.campaign_repo, "create_send_log", fake_create_send_log)
    monkeypatch.setattr(svc.campaign_media_svc, "ensure_campaign_image_media_id", fake_ensure_campaign_image_media_id)

    processed = await svc.process_campaign_batch(db, campaign, whatsapp_client=FakeWhatsAppClient())

    assert processed == 1
    assert image_calls == [
        {
            "to": recipient.phone,
            "body": campaign.message_body,
            "media_id": "media-123",
            "buttons": [{"id": campaign.booking_button_id, "title": campaign.button_label}],
            "footer": campaign.message_footer,
        }
    ]


@pytest.mark.asyncio
async def test_process_campaign_batch_uses_text_button_path_when_image_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    campaign = _campaign(image_path=None, image_media_id=None)
    recipient = _recipient(campaign_id=campaign.id)
    text_calls: list[dict[str, object]] = []

    async def fake_list_pending_recipients(_db, *, campaign_id, limit):
        return [recipient]

    async def fake_update_recipient_status(_db, *, recipient, delivery_status, provider_message_id=None, error_message=None):
        recipient.delivery_status = delivery_status
        return recipient

    async def fake_create_send_log(_db, **kwargs):
        return SimpleNamespace(**kwargs)

    class FakeWhatsAppClient:
        async def send_button_message(self, *, to, body, buttons):
            text_calls.append({"to": to, "body": body, "buttons": buttons})
            return {"messages": [{"id": "wamid.text"}]}

    monkeypatch.setattr(svc.campaign_repo, "list_pending_recipients", fake_list_pending_recipients)
    monkeypatch.setattr(svc.campaign_repo, "update_recipient_status", fake_update_recipient_status)
    monkeypatch.setattr(svc.campaign_repo, "create_send_log", fake_create_send_log)

    processed = await svc.process_campaign_batch(db, campaign, whatsapp_client=FakeWhatsAppClient())

    assert processed == 1
    assert text_calls == [
        {
            "to": recipient.phone,
            "body": campaign.message_body,
            "buttons": [{"id": campaign.booking_button_id, "title": campaign.button_label}],
        }
    ]


@pytest.mark.asyncio
async def test_pause_campaign_updates_state(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    campaign = _campaign(started_at=datetime.now(timezone.utc))

    async def fake_get_campaign_by_id(_db, campaign_id):
        assert campaign_id == campaign.id
        return campaign

    monkeypatch.setattr(svc.campaign_repo, "get_campaign_by_id", fake_get_campaign_by_id)

    paused = await svc.pause_campaign(db, campaign_id=campaign.id)

    assert paused is campaign
    assert campaign.status == CampaignStatus.PAUSED
    assert campaign.run_status == CampaignRunStatus.PAUSED
    assert db.flush_calls == 1


@pytest.mark.asyncio
async def test_pause_campaign_endpoint_returns_detail_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    campaign = _campaign(started_at=datetime.now(timezone.utc))
    detail_payload = {
        "id": str(campaign.id),
        "status": CampaignStatus.PAUSED.value,
        "run_status": CampaignRunStatus.PAUSED.value,
        "metrics": {"targeted": 2, "pending": 1, "sent": 1, "failed": 0},
    }

    async def fake_pause_campaign(_db, *, campaign_id):
        assert campaign_id == campaign.id
        campaign.status = CampaignStatus.PAUSED
        campaign.run_status = CampaignRunStatus.PAUSED
        return campaign

    async def fake_get_campaign_detail(_db, *, campaign_id):
        assert campaign_id == campaign.id
        return detail_payload

    monkeypatch.setattr(campaigns_api.campaign_runner_svc, "pause_campaign", fake_pause_campaign)
    monkeypatch.setattr(campaigns_api.campaign_repo, "get_campaign_detail", fake_get_campaign_detail)

    result = await campaigns_api.pause_campaign(campaign.id, db=FakeDB())

    assert result == detail_payload


def test_delivery_metrics_are_cumulative_for_progressed_recipients() -> None:
    recipients = [
        _recipient(delivery_status=CampaignDeliveryStatus.PENDING),
        _recipient(delivery_status=CampaignDeliveryStatus.SENT),
        _recipient(delivery_status=CampaignDeliveryStatus.DELIVERED),
        _recipient(delivery_status=CampaignDeliveryStatus.READ),
        _recipient(delivery_status=CampaignDeliveryStatus.CLICKED),
        _recipient(delivery_status=CampaignDeliveryStatus.FAILED),
    ]

    metrics = campaign_repo._delivery_metrics(recipients)

    assert metrics["targeted"] == 6
    assert metrics["pending"] == 1
    assert metrics["sent"] == 4
    assert metrics["delivered"] == 3
    assert metrics["read"] == 2
    assert metrics["clicked"] == 1
    assert metrics["failed"] == 1
