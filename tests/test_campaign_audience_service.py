from __future__ import annotations

import re
from types import SimpleNamespace
import uuid

import pytest
from sqlalchemy.sql import operators

from app.models.campaign import CampaignAudienceType
from app.repositories import customer_repository as customer_repo
from app.services import campaign_audience_service as svc


def _customer(*, phone: str, name: str | None = None, customer_id: uuid.UUID | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=customer_id or uuid.uuid4(),
        phone=phone,
        name=name,
    )


class _FakeInactiveResult:
    def __init__(self, rows: list[SimpleNamespace]) -> None:
        self._rows = rows

    def scalars(self) -> "_FakeInactiveResult":
        return self

    def all(self) -> list[SimpleNamespace]:
        return self._rows


class _FakeInactiveDB:
    def __init__(self, boundary_customer: SimpleNamespace) -> None:
        self.boundary_customer = boundary_customer

    async def execute(self, statement):
        def _contains_inclusive_operator(node) -> bool:
            if getattr(node, "operator", None) is operators.le:
                return True
            for child in getattr(node, "get_children", lambda: [])():
                if _contains_inclusive_operator(child):
                    return True
            return False

        assert _contains_inclusive_operator(statement)
        return _FakeInactiveResult([self.boundary_customer])


class _FakeQueryResult:
    def scalars(self) -> "_FakeQueryResult":
        return self

    def all(self) -> list[SimpleNamespace]:
        return []


class _QueryInspectDB:
    def __init__(self, *, expect_inclusive: bool = False) -> None:
        self.expect_inclusive = expect_inclusive
        self.seen_function_names: list[str] = []

    async def execute(self, statement):
        def _contains_inclusive_operator(node) -> bool:
            if getattr(node, "operator", None) is operators.le:
                return True
            for child in getattr(node, "get_children", lambda: [])():
                if _contains_inclusive_operator(child):
                    return True
            return False

        def _collect_function_names(node) -> None:
            name = getattr(node, "name", None)
            if name:
                self.seen_function_names.append(str(name))
            for child in getattr(node, "get_children", lambda: [])():
                _collect_function_names(child)

        _collect_function_names(statement)
        assert "regexp_replace" in self.seen_function_names
        assert "substr" in self.seen_function_names
        assert "length" in self.seen_function_names
        if self.expect_inclusive:
            assert _contains_inclusive_operator(statement)
        return _FakeQueryResult()


@pytest.mark.asyncio
async def test_uploaded_phone_list_deduplicates_and_normalizes_numbers() -> None:
    campaign = SimpleNamespace(
        audience_type=CampaignAudienceType.UPLOADED_PHONE_LIST,
        audience_filters={
            "phones": [
                "+91 98765 43210",
                "919876543210",
                "(91) 98765-43210",
            ]
        },
    )

    drafts = await svc.resolve_campaign_audience(object(), campaign)

    assert [draft.phone for draft in drafts] == ["919876543210"]
    assert [draft.display_name for draft in drafts] == ["919876543210"]
    assert [draft.source_type for draft in drafts] == ["upload"]
    assert all(draft.customer_id is None for draft in drafts)


@pytest.mark.asyncio
async def test_uploaded_phone_list_keeps_distinct_leading_zero_variants_separate() -> None:
    campaign = SimpleNamespace(
        audience_type=CampaignAudienceType.UPLOADED_PHONE_LIST,
        audience_filters={
            "phones": [
                "00123456789",
                "123456789",
            ]
        },
    )

    drafts = await svc.resolve_campaign_audience(object(), campaign)

    assert [draft.phone for draft in drafts] == ["0123456789", "123456789"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "filters, expected_message",
    [
        ({}, "audience_filters['inactive_days'] is required"),
        ({"inactive_days": 0}, "audience_filters['inactive_days'] must be greater than 0"),
    ],
)
async def test_inactive_audience_requires_days_filter(filters: dict[str, object], expected_message: str) -> None:
    campaign = SimpleNamespace(
        audience_type=CampaignAudienceType.CUSTOMERS_INACTIVE_FOR_DAYS,
        audience_filters=filters,
    )

    with pytest.raises(ValueError, match=re.escape(expected_message)):
        await svc.resolve_campaign_audience(object(), campaign)


@pytest.mark.asyncio
async def test_customers_inactive_for_days_includes_customer_at_cutoff_boundary() -> None:
    boundary_customer = _customer(phone="+919222222222", name="Boundary")
    fake_db = _FakeInactiveDB(boundary_customer)
    campaign = SimpleNamespace(
        audience_type=CampaignAudienceType.CUSTOMERS_INACTIVE_FOR_DAYS,
        audience_filters={"inactive_days": 30},
    )

    drafts = await svc.resolve_campaign_audience(fake_db, campaign)

    assert len(drafts) == 1
    assert drafts[0].phone == "919222222222"
    assert drafts[0].display_name == "Boundary"
    assert drafts[0].customer_id == boundary_customer.id
    assert drafts[0].source_type == "customers_inactive_for_days"


@pytest.mark.asyncio
async def test_previous_bookings_query_uses_repository_normalization_helpers() -> None:
    db = _QueryInspectDB()

    await customer_repo.list_customers_with_previous_bookings(db)

    assert "regexp_replace" in db.seen_function_names
    assert "substr" in db.seen_function_names
    assert "length" in db.seen_function_names


@pytest.mark.asyncio
async def test_inactive_days_query_uses_repository_normalization_helpers_and_inclusive_cutoff() -> None:
    db = _QueryInspectDB(expect_inclusive=True)

    await customer_repo.list_customers_inactive_for_days(db, 30)

    assert "regexp_replace" in db.seen_function_names
    assert "substr" in db.seen_function_names
    assert "length" in db.seen_function_names


@pytest.mark.asyncio
async def test_all_customers_returns_normalized_deduped_rows_from_repository_data(monkeypatch: pytest.MonkeyPatch) -> None:
    repo_rows = [
        _customer(phone="+919999999999", name=None),
        _customer(phone="919999999999", name="Duplicate Name"),
        _customer(phone="098888888888", name="Rita"),
    ]

    async def fake_list_contactable_customers(_db):
        return repo_rows

    monkeypatch.setattr(svc.customer_repo, "list_contactable_customers", fake_list_contactable_customers)

    campaign = SimpleNamespace(
        audience_type=CampaignAudienceType.ALL_CUSTOMERS,
        audience_filters={},
    )

    drafts = await svc.resolve_campaign_audience(object(), campaign)

    assert [draft.phone for draft in drafts] == ["919999999999", "98888888888"]
    assert [draft.display_name for draft in drafts] == ["919999999999", "Rita"]
    assert [draft.customer_id for draft in drafts] == [repo_rows[0].id, repo_rows[2].id]
    assert [draft.source_type for draft in drafts] == ["all_customers", "all_customers"]


@pytest.mark.asyncio
async def test_previous_bookings_mode_returns_only_customers_with_booking_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    booked_customer = _customer(phone="+919111111111", name="Booked")

    async def fake_list_customers_with_previous_bookings(_db):
        return [booked_customer]

    called = {"count": 0}

    async def tracking_list_contactable_customers(_db):
        called["count"] += 1
        return []

    monkeypatch.setattr(svc.customer_repo, "list_customers_with_previous_bookings", fake_list_customers_with_previous_bookings)
    monkeypatch.setattr(svc.customer_repo, "list_contactable_customers", tracking_list_contactable_customers)

    campaign = SimpleNamespace(
        audience_type=CampaignAudienceType.CUSTOMERS_WITH_PREVIOUS_BOOKINGS,
        audience_filters={},
    )

    drafts = await svc.resolve_campaign_audience(object(), campaign)

    assert [draft.phone for draft in drafts] == ["919111111111"]
    assert [draft.display_name for draft in drafts] == ["Booked"]
    assert [draft.customer_id for draft in drafts] == [booked_customer.id]
    assert [draft.source_type for draft in drafts] == ["customers_with_previous_bookings"]
    assert called["count"] == 0
