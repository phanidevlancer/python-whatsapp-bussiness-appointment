# Campaign Runner V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable admin-driven campaign runner with creative upload, audience selection, batch rollout, recipient tracking, and campaign detail metrics on top of the existing WhatsApp campaign attribution flow.

**Architecture:** Extend the current `Campaign` model into a full campaign definition, add recipient and send-log tables for delivery state, isolate audience resolution and batch sending into dedicated backend services, and replace the basic `/campaigns` page with a structured builder and detail view. Keep rollout in-process for v1, but encapsulate the runner behind service boundaries so it can later move to a proper worker queue.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, Alembic, Pydantic, httpx, React, Next.js App Router, TanStack Query, TypeScript

---

## File Structure

### Backend files to modify

- `app/models/campaign.py`
  - Expand campaign status and add creative, audience, and rollout fields.
- `app/models/__init__.py`
  - Export new campaign-related models and enums.
- `app/db/base.py`
  - Register new models for Alembic metadata.
- `app/schemas/campaign.py`
  - Replace thin CRUD schemas with builder, detail, metrics, and launch schemas.
- `app/repositories/campaign_repository.py`
  - Add campaign detail, recipient, and metrics queries plus update helpers.
- `app/api/v1/campaigns.py`
  - Add endpoints for create/update detail, upload image, start campaign, pause campaign, and recipients.
- `app/integrations/whatsapp_client.py`
  - Add media upload and media-header interactive send helpers.
- `app/services/booking_flow_service.py`
  - Stamp recipient click state when campaign button starts a journey.
- `app/services/dashboard_service.py`
  - Reuse or extend metrics aggregation where detail views need richer recipient stats.
- `main.py`
  - Ensure static uploads are served if needed for CRM preview.

### Backend files to create

- `app/models/campaign_recipient.py`
  - Recipient snapshot table and delivery-status enum.
- `app/models/campaign_send_log.py`
  - Operational send-attempt log table.
- `app/services/campaign_audience_service.py`
  - Audience resolution and phone normalization.
- `app/services/campaign_media_service.py`
  - Filesystem storage helpers and Meta media upload orchestration.
- `app/services/campaign_runner_service.py`
  - Launch validation, recipient creation, batch sending, status transitions.
- `app/repositories/customer_repository.py` or a focused query module if no reusable customer repository exists
  - Audience queries for booking history and inactivity.

### Frontend files to modify

- `crm-frontend/src/types/campaign.ts`
  - Add full campaign builder, detail, recipient, and metrics types.
- `crm-frontend/src/hooks/useCampaigns.ts`
  - Add detail, upload, start, pause, and recipients hooks.
- `crm-frontend/src/app/(dashboard)/campaigns/page.tsx`
  - Replace the thin create panel with management + builder entry.

### Frontend files to create

- `crm-frontend/src/app/(dashboard)/campaigns/[id]/page.tsx`
  - Campaign detail with delivery and booking metrics.
- `crm-frontend/src/components/campaigns/CampaignBuilder.tsx`
  - Structured create/edit form.
- `crm-frontend/src/components/campaigns/CampaignCreativeUpload.tsx`
  - Image upload and preview.
- `crm-frontend/src/components/campaigns/CampaignAudienceFields.tsx`
  - Conditional audience controls.
- `crm-frontend/src/components/campaigns/CampaignMetricsCards.tsx`
  - Reusable metric cards.
- `crm-frontend/src/components/campaigns/CampaignRecipientsTable.tsx`
  - Recipient status list.

### Migration and tests

- `alembic/versions/<new_revision>_campaign_runner_v1.py`
  - Schema changes for campaign expansion, recipients, and send logs.
- `tests/test_campaigns_api.py`
  - API validation and lifecycle tests.
- `tests/test_campaign_audience_service.py`
  - Audience resolution coverage.
- `tests/test_campaign_runner_service.py`
  - Batch rollout and send logging tests.
- `tests/test_campaign_media_service.py`
  - Upload and media metadata tests.
- `tests/test_campaigns.py`
  - Extend existing campaign utility coverage for new rules.
- `crm-frontend` component tests if the repo already has a frontend test setup; otherwise keep frontend verification to build/typecheck plus manual verification.

### Task 1: Expand the campaign domain model

**Files:**
- Modify: `app/models/campaign.py`
- Modify: `app/models/__init__.py`
- Modify: `app/db/base.py`
- Create: `app/models/campaign_recipient.py`
- Create: `app/models/campaign_send_log.py`
- Test: `tests/test_campaigns.py`

- [ ] **Step 1: Write the failing metadata tests**

```python
def test_campaign_tables_and_columns_are_registered() -> None:
    assert "campaigns" in Base.metadata.tables
    assert "campaign_recipients" in Base.metadata.tables
    assert "campaign_send_logs" in Base.metadata.tables

    campaign_columns = Base.metadata.tables["campaigns"].columns.keys()
    for column_name in (
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
    ):
        assert column_name in campaign_columns
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_campaigns.py::test_campaign_tables_and_columns_are_registered -q`
Expected: FAIL because the new tables and columns do not exist yet.

- [ ] **Step 3: Implement the model changes**

```python
class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class CampaignAudienceType(str, enum.Enum):
    ALL_CUSTOMERS = "all_customers"
    CUSTOMERS_WITH_PREVIOUS_BOOKINGS = "customers_with_previous_bookings"
    CUSTOMERS_INACTIVE_FOR_DAYS = "customers_inactive_for_days"
    UPLOADED_PHONE_LIST = "uploaded_phone_list"
```

```python
class CampaignRecipientDeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    CLICKED = "clicked"
    FAILED = "failed"
    SKIPPED = "skipped"
```

- [ ] **Step 4: Run the metadata test again**

Run: `pytest tests/test_campaigns.py::test_campaign_tables_and_columns_are_registered -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/models/campaign.py app/models/campaign_recipient.py app/models/campaign_send_log.py app/models/__init__.py app/db/base.py tests/test_campaigns.py
git commit -m "feat: expand campaign domain models"
```

### Task 2: Add the database migration

**Files:**
- Create: `alembic/versions/<new_revision>_campaign_runner_v1.py`
- Test: migration application via Alembic

- [ ] **Step 1: Write the migration**

```python
def upgrade() -> None:
    op.add_column("campaigns", sa.Column("audience_type", sa.Enum(...), nullable=False, server_default="all_customers"))
    op.add_column("campaigns", sa.Column("audience_filters", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("campaigns", sa.Column("message_body", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("message_footer", sa.String(length=60), nullable=True))
    op.add_column("campaigns", sa.Column("button_label", sa.String(length=20), nullable=True))
    op.add_column("campaigns", sa.Column("image_path", sa.String(length=255), nullable=True))
    op.add_column("campaigns", sa.Column("image_media_id", sa.String(length=120), nullable=True))
    op.add_column("campaigns", sa.Column("batch_size", sa.Integer(), nullable=False, server_default="50"))
    op.add_column("campaigns", sa.Column("batch_delay_seconds", sa.Integer(), nullable=False, server_default="60"))
    op.add_column("campaigns", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("last_error", sa.Text(), nullable=True))
    op.create_table(...)
    op.create_table(...)
```

- [ ] **Step 2: Apply the migration**

Run: `alembic upgrade head`
Expected: upgrade succeeds and the new tables/columns appear in PostgreSQL.

- [ ] **Step 3: Smoke-check the schema**

Run: `psql postgresql://postgres:password@localhost:5432/whatsapp_booking -c "\d campaigns"`
Expected: shows the new creative, audience, and rollout columns.

- [ ] **Step 4: Commit**

```bash
git add alembic/versions/<new_revision>_campaign_runner_v1.py
git commit -m "feat: add campaign runner schema"
```

### Task 3: Define validated campaign API schemas

**Files:**
- Modify: `app/schemas/campaign.py`
- Test: `tests/test_campaigns_api.py`

- [ ] **Step 1: Write failing schema validation tests**

```python
def test_campaign_create_requires_allowed_services() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="diwali-hydra",
            name="Diwali Hydra",
            allowed_service_ids=[],
            discount_type="percent",
            discount_value=Decimal("50.00"),
            audience_type="all_customers",
            message_body="Offer text",
            button_label="Book Now",
        )
```

```python
def test_campaign_create_rejects_invalid_percent_discount() -> None:
    with pytest.raises(ValidationError):
        CampaignCreate(
            code="bad-offer",
            name="Bad Offer",
            allowed_service_ids=[uuid4()],
            discount_type="percent",
            discount_value=Decimal("150.00"),
            audience_type="all_customers",
            message_body="Offer text",
            button_label="Book Now",
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_campaigns_api.py -q`
Expected: FAIL because the schema does not yet validate these rules.

- [ ] **Step 3: Implement the schema and validators**

```python
class CampaignCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    allowed_service_ids: list[uuid.UUID]
    allowed_weekdays: list[int] = Field(default_factory=list)
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    per_user_booking_limit: int | None = None
    discount_type: CampaignDiscountType = CampaignDiscountType.NONE
    discount_value: Decimal | None = None
    audience_type: CampaignAudienceType
    audience_filters: dict[str, Any] = Field(default_factory=dict)
    message_body: str
    message_footer: str | None = None
    button_label: str
    image_path: str | None = None
    batch_size: int = 50
    batch_delay_seconds: int = 60
```

- [ ] **Step 4: Run schema tests again**

Run: `pytest tests/test_campaigns_api.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/schemas/campaign.py tests/test_campaigns_api.py
git commit -m "feat: validate campaign builder payloads"
```

### Task 4: Add audience resolution service

**Files:**
- Create: `app/services/campaign_audience_service.py`
- Modify: `app/repositories/campaign_repository.py`
- Create or Modify: `app/repositories/customer_repository.py`
- Test: `tests/test_campaign_audience_service.py`

- [ ] **Step 1: Write failing audience tests**

```python
async def test_resolve_uploaded_phone_list_deduplicates_numbers() -> None:
    campaign = SimpleNamespace(
        audience_type="uploaded_phone_list",
        audience_filters={"phones": ["+919111111111", "919111111111", " 919222222222 "]},
    )

    recipients = await resolve_campaign_recipients(db=None, campaign=campaign)

    assert [recipient.phone for recipient in recipients] == ["919111111111", "919222222222"]
```

```python
async def test_resolve_inactive_customers_requires_days_filter() -> None:
    campaign = SimpleNamespace(audience_type="customers_inactive_for_days", audience_filters={})
    with pytest.raises(ValueError):
        await resolve_campaign_recipients(db=session, campaign=campaign)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_campaign_audience_service.py -q`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement resolution helpers**

```python
async def resolve_campaign_recipients(db: AsyncSession, campaign: Campaign) -> list[CampaignRecipientDraft]:
    if campaign.audience_type == CampaignAudienceType.UPLOADED_PHONE_LIST:
        phones = campaign.audience_filters.get("phones", [])
        return build_uploaded_recipients(phones)

    if campaign.audience_type == CampaignAudienceType.ALL_CUSTOMERS:
        rows = await customer_repo.list_all_contactable_customers(db)
        return dedupe_customer_rows(rows)

    if campaign.audience_type == CampaignAudienceType.CUSTOMERS_WITH_PREVIOUS_BOOKINGS:
        rows = await customer_repo.list_customers_with_bookings(db)
        return dedupe_customer_rows(rows)

    if campaign.audience_type == CampaignAudienceType.CUSTOMERS_INACTIVE_FOR_DAYS:
        inactivity_days = int(campaign.audience_filters["inactivity_days"])
        rows = await customer_repo.list_customers_inactive_for_days(db, inactivity_days)
        return dedupe_customer_rows(rows)

    raise ValueError(f"Unsupported audience type: {campaign.audience_type}")
```

- [ ] **Step 4: Run the audience tests**

Run: `pytest tests/test_campaign_audience_service.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/campaign_audience_service.py app/repositories/campaign_repository.py app/repositories/customer_repository.py tests/test_campaign_audience_service.py
git commit -m "feat: add campaign audience resolution"
```

### Task 5: Add campaign media upload and WhatsApp media support

**Files:**
- Create: `app/services/campaign_media_service.py`
- Modify: `app/integrations/whatsapp_client.py`
- Modify: `app/api/v1/campaigns.py`
- Test: `tests/test_campaign_media_service.py`

- [ ] **Step 1: Write failing media tests**

```python
async def test_store_campaign_image_writes_file_under_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CAMPAIGN_UPLOAD_DIR", str(tmp_path))
    saved = await store_campaign_image(filename="offer.png", content=b"png-bytes")
    assert saved.relative_path.startswith("uploads/campaigns/")
```

```python
async def test_upload_to_meta_is_skipped_when_media_id_already_present() -> None:
    campaign = SimpleNamespace(image_path="uploads/campaigns/offer.png", image_media_id="123")
    media_id = await ensure_campaign_media_id(campaign, wa_client=FakeClient())
    assert media_id == "123"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_campaign_media_service.py -q`
Expected: FAIL because the upload service does not exist.

- [ ] **Step 3: Implement storage and client helpers**

```python
async def upload_media(self, file_path: str, mime_type: str) -> dict:
    with open(file_path, "rb") as file_obj:
        files = {"file": (Path(file_path).name, file_obj, mime_type)}
        data = {"messaging_product": "whatsapp", "type": mime_type}
        response = await self._client.post(self._media_url, headers={"Authorization": ...}, data=data, files=files)
```

```python
async def send_media_button_message(
    self,
    to: str,
    image_media_id: str,
    body: str,
    footer: str | None,
    button_id: str,
    button_title: str,
) -> dict:
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "header": {"type": "image", "image": {"id": image_media_id}},
            "body": {"text": body},
            "footer": {"text": footer} if footer else None,
            "action": {"buttons": [{"type": "reply", "reply": {"id": button_id, "title": button_title}}]},
        },
    }
```

- [ ] **Step 4: Run the media tests**

Run: `pytest tests/test_campaign_media_service.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/campaign_media_service.py app/integrations/whatsapp_client.py app/api/v1/campaigns.py tests/test_campaign_media_service.py
git commit -m "feat: add campaign creative upload support"
```

### Task 6: Add campaign runner service and lifecycle endpoints

**Files:**
- Create: `app/services/campaign_runner_service.py`
- Modify: `app/repositories/campaign_repository.py`
- Modify: `app/api/v1/campaigns.py`
- Test: `tests/test_campaign_runner_service.py`

- [ ] **Step 1: Write failing runner tests**

```python
async def test_start_campaign_creates_recipients_and_marks_running(monkeypatch: pytest.MonkeyPatch) -> None:
    campaign = build_campaign(status="draft")
    recipients = [CampaignRecipientDraft(phone="919111111111", display_name="A", customer_id=None, source_type="upload")]

    monkeypatch.setattr(audience_service, "resolve_campaign_recipients", AsyncMock(return_value=recipients))
    monkeypatch.setattr(runner_service, "_dispatch_batch_task", lambda *args, **kwargs: None)

    result = await start_campaign_run(db=session, campaign=campaign, wa_client=FakeClient())

    assert result.status == CampaignStatus.RUNNING
    assert result.recipient_count == 1
```

```python
async def test_process_campaign_batch_marks_failed_recipient_on_send_error() -> None:
    ...
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_campaign_runner_service.py -q`
Expected: FAIL because the runner does not exist.

- [ ] **Step 3: Implement runner lifecycle**

```python
async def start_campaign_run(db: AsyncSession, campaign: Campaign, wa_client: WhatsAppClient) -> CampaignLaunchResult:
    validate_campaign_launchable(campaign)
    recipient_drafts = await audience_service.resolve_campaign_recipients(db, campaign)
    recipients = await campaign_repo.create_campaign_recipients(db, campaign.id, recipient_drafts)
    campaign.status = CampaignStatus.RUNNING
    campaign.started_at = utcnow()
    await db.flush()
    _dispatch_batch_task(campaign_id=campaign.id)
    return CampaignLaunchResult(...)
```

```python
async def process_campaign_batch(campaign_id: UUID) -> None:
    async with SessionLocal() as db:
        campaign = await campaign_repo.get_campaign_by_id(db, campaign_id)
        pending = await campaign_repo.list_pending_recipients(db, campaign_id, limit=campaign.batch_size)
        ...
```

- [ ] **Step 4: Run runner tests**

Run: `pytest tests/test_campaign_runner_service.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/campaign_runner_service.py app/repositories/campaign_repository.py app/api/v1/campaigns.py tests/test_campaign_runner_service.py
git commit -m "feat: add campaign rollout runner"
```

### Task 7: Attach recipient click state to campaign booking entry

**Files:**
- Modify: `app/services/booking_flow_service.py`
- Modify: `app/repositories/campaign_repository.py`
- Test: `tests/test_campaigns.py`

- [ ] **Step 1: Write the failing click-stamp test**

```python
async def test_campaign_button_click_marks_matching_recipient_clicked(monkeypatch: pytest.MonkeyPatch) -> None:
    mark_clicked = AsyncMock()
    monkeypatch.setattr(campaign_repo, "mark_recipient_clicked", mark_clicked)
    ...
    await _process_message(payload, db, session_svc, wa_client)
    mark_clicked.assert_awaited_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_campaigns.py::test_campaign_button_click_marks_matching_recipient_clicked -q`
Expected: FAIL because the repository and flow do not stamp recipients yet.

- [ ] **Step 3: Implement click stamping**

```python
await campaign_repo.mark_recipient_clicked(
    db,
    campaign_id=campaign.id,
    phone=sender,
)
```

- [ ] **Step 4: Run the targeted test**

Run: `pytest tests/test_campaigns.py::test_campaign_button_click_marks_matching_recipient_clicked -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/booking_flow_service.py app/repositories/campaign_repository.py tests/test_campaigns.py
git commit -m "feat: track campaign recipient clicks"
```

### Task 8: Build the frontend campaign builder

**Files:**
- Modify: `crm-frontend/src/types/campaign.ts`
- Modify: `crm-frontend/src/hooks/useCampaigns.ts`
- Create: `crm-frontend/src/components/campaigns/CampaignBuilder.tsx`
- Create: `crm-frontend/src/components/campaigns/CampaignCreativeUpload.tsx`
- Create: `crm-frontend/src/components/campaigns/CampaignAudienceFields.tsx`
- Modify: `crm-frontend/src/app/(dashboard)/campaigns/page.tsx`

- [ ] **Step 1: Write the failing UI expectations**

Document the acceptance criteria in comments or existing frontend test harness:

```tsx
// Expect the builder to render:
// - service multi-select
// - discount type segmented control
// - conditional discount input
// - image upload field
// - message body/footer/button label inputs
// - audience mode selector
// - inactivity days or phone list controls when required
// - start campaign action
```

- [ ] **Step 2: Run frontend verification to capture the current gap**

Run: `npm run build`
Expected: existing unrelated build issue may still fail, but confirm the current `/campaigns` page does not include the required builder sections.

- [ ] **Step 3: Implement the builder components**

```tsx
type CampaignBuilderForm = {
  name: string;
  code: string;
  description: string;
  allowed_service_ids: string[];
  allowed_weekdays: number[];
  valid_from: string;
  valid_to: string;
  per_user_booking_limit: string;
  discount_type: CampaignDiscountType;
  discount_value: string;
  audience_type: CampaignAudienceType;
  inactivity_days: string;
  uploaded_phones_text: string;
  message_body: string;
  message_footer: string;
  button_label: string;
  image_path: string | null;
}
```

- [ ] **Step 4: Verify the page manually**

Run the dev server if needed and verify:
- `/campaigns` shows the new builder sections
- services are loaded from the services query
- invalid discount values are blocked in the form
- image upload control updates preview state

- [ ] **Step 5: Commit**

```bash
git add crm-frontend/src/types/campaign.ts crm-frontend/src/hooks/useCampaigns.ts crm-frontend/src/components/campaigns/CampaignBuilder.tsx crm-frontend/src/components/campaigns/CampaignCreativeUpload.tsx crm-frontend/src/components/campaigns/CampaignAudienceFields.tsx crm-frontend/src/app/\(dashboard\)/campaigns/page.tsx
git commit -m "feat: add campaign builder ui"
```

### Task 9: Build campaign detail and recipient views

**Files:**
- Create: `crm-frontend/src/app/(dashboard)/campaigns/[id]/page.tsx`
- Create: `crm-frontend/src/components/campaigns/CampaignMetricsCards.tsx`
- Create: `crm-frontend/src/components/campaigns/CampaignRecipientsTable.tsx`
- Modify: `crm-frontend/src/hooks/useCampaigns.ts`

- [ ] **Step 1: Define the expected detail data contract**

```ts
export interface CampaignDetail extends Campaign {
  recipients_total: number;
  recipients_pending: number;
  recipients_sent: number;
  recipients_delivered: number;
  recipients_read: number;
  recipients_clicked: number;
  recipients_failed: number;
  bookings: number;
  completed: number;
  cancelled: number;
  total_service_value: number | string;
  total_final_value: number | string;
}
```

- [ ] **Step 2: Implement the detail hooks and page**

```tsx
const { data: campaign, isLoading } = useCampaignDetail(params.id);
const { data: recipients } = useCampaignRecipients(params.id);
```

- [ ] **Step 3: Verify the detail UX manually**

Confirm:
- `/campaigns/[id]` renders metrics cards
- recipient statuses are visible
- image preview and campaign rule summary are visible

- [ ] **Step 4: Commit**

```bash
git add crm-frontend/src/app/\(dashboard\)/campaigns/\[id\]/page.tsx crm-frontend/src/components/campaigns/CampaignMetricsCards.tsx crm-frontend/src/components/campaigns/CampaignRecipientsTable.tsx crm-frontend/src/hooks/useCampaigns.ts crm-frontend/src/types/campaign.ts
git commit -m "feat: add campaign detail dashboard"
```

### Task 10: Verify end-to-end behavior and seed/demo data

**Files:**
- Modify: `app/db/seed.py`
- Modify: `tests/test_campaigns_api.py`
- Modify: `tests/test_campaign_runner_service.py`

- [ ] **Step 1: Update seed data for richer campaigns**

```python
campaign_specs = (
    {
        "code": "diwali-hydra-50-sun",
        "name": "Diwali Hydra 50",
        "allowed_service_ids": [hydra_service_id],
        "audience_type": CampaignAudienceType.ALL_CUSTOMERS,
        "message_body": "Glow-ready skin this Sunday. Get 50% off Hydra Facial.",
        "message_footer": "ORA Clinic",
        "button_label": "Book Diwali Offer",
        "batch_size": 50,
        "batch_delay_seconds": 60,
    },
)
```

- [ ] **Step 2: Run backend test suite for campaign work**

Run: `pytest tests/test_campaigns.py tests/test_campaigns_api.py tests/test_campaign_audience_service.py tests/test_campaign_media_service.py tests/test_campaign_runner_service.py -q`
Expected: PASS

- [ ] **Step 3: Re-apply seed data**

Run: `venv/bin/python -m app.db.seed`
Expected: seed succeeds and test campaigns are present with creative/audience defaults.

- [ ] **Step 4: Perform manual verification**

Verify:
- create a campaign from `/campaigns`
- upload an image
- start a campaign
- confirm recipients are created
- send a real WhatsApp test message to a target number
- tap the campaign button and verify click/book attribution
- send `hi` afterward and verify organic reset still works

- [ ] **Step 5: Capture known limitations**

Document in final notes:
- rollout is in-process and can stall on app restart
- frontend build may still be blocked by unrelated pre-existing type issues if they remain unresolved

- [ ] **Step 6: Commit**

```bash
git add app/db/seed.py tests/test_campaigns_api.py tests/test_campaign_runner_service.py
git commit -m "feat: verify campaign runner v1"
```
