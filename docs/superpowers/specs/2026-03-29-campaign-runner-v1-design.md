# Campaign Runner V1 Design

## Goal

Extend the existing WhatsApp campaign attribution system into an admin-driven campaign runner that lets staff create an offer, upload creative, target an audience, roll the message out in batches, and measure send and booking performance without breaking the current organic-vs-campaign attribution rules.

## Current Context

- Backend already supports `campaigns`, campaign-aware booking journeys, service eligibility, booking-time price snapshots, and campaign performance aggregation from appointments.
- Frontend already has a basic `/campaigns` screen, but it only creates a thin campaign record with name, code, button id, and discount fields.
- WhatsApp sending currently supports text, list, button, and flow messages through `WhatsAppClient`, but there is no concept of a campaign delivery run, campaign recipients, or uploaded media.
- The user-approved v1 scope is:
  - service selection from CRM, not manual ids
  - constrained discount configuration
  - image upload in CRM
  - message body/footer/button label authoring
  - audience selection from a small supported set
  - `Send Now` only
  - local file storage for uploaded campaign images
  - immediate batched rollout

## Product Rules

### Attribution

- A booking is attributed to a campaign only when the active booking journey was started from that campaign's explicit entry point.
- Organic entry points such as `hi` and `book_appointment` clear campaign context and produce organic bookings.
- Campaign delivery alone does not imply campaign attribution.

### Offer Eligibility

- A campaign can restrict which services are eligible.
- A campaign can restrict valid weekdays and valid date range.
- A campaign discount applies only to eligible services booked through the campaign journey.
- If no services are configured, the campaign is invalid for launch in v1. V1 should force at least one eligible service to avoid the current "all services" ambiguity.

### Audience

V1 supports exactly these audience modes:

1. `all_customers`
2. `customers_with_previous_bookings`
3. `customers_inactive_for_days`
4. `uploaded_phone_list`

For `customers_inactive_for_days`, the admin must provide the inactivity threshold.
For `uploaded_phone_list`, the admin can paste numbers or upload a CSV/text file in the CRM.

### Rollout

- V1 supports `Send Now` only.
- Delivery is performed in batches by backend logic, not synchronously in the request thread.
- Default rollout settings should be stored on the campaign and used by the runner:
  - `batch_size = 50`
  - `batch_delay_seconds = 60`
- Staff can pause an active campaign. Resume is optional for v1; if not implemented, paused campaigns can remain terminal for the first release.

## Data Model

### Campaign

Extend the existing `campaigns` table so it becomes the single source of truth for campaign definition, creative, targeting, and rollout status.

Add fields:

- `status`: move from the current simple status set to delivery-aware states
  - `draft`
  - `running`
  - `paused`
  - `completed`
  - `failed`
- `audience_type`
- `audience_filters` JSON for values like inactivity days
- `message_body`
- `message_footer`
- `button_label`
- `image_path`
- `image_media_id`
- `batch_size`
- `batch_delay_seconds`
- `started_at`
- `completed_at`
- `failed_at`
- `last_error`

Keep existing fields:

- `code`
- `name`
- `description`
- `booking_button_id`
- `allowed_service_ids`
- `allowed_weekdays`
- `valid_from`
- `valid_to`
- `per_user_booking_limit`
- `discount_type`
- `discount_value`

### Campaign Recipient

Create a `campaign_recipients` table to materialize the audience at launch time.

Fields:

- `id`
- `campaign_id`
- `customer_id` nullable
- `phone`
- `display_name`
- `source_type` (`crm`, `upload`)
- `delivery_status` (`pending`, `sent`, `delivered`, `read`, `clicked`, `failed`, `skipped`)
- `failure_reason`
- `sent_at`
- `delivered_at`
- `read_at`
- `clicked_at`
- `booked_at`
- `created_at`
- `updated_at`

Notes:

- `customer_id` is nullable so uploaded lists can work without a CRM customer record.
- Recipients are snapshotted at launch time so audience counts and delivery reporting do not drift if the CRM changes later.

### Campaign Send Log

Create a `campaign_send_logs` table for operational visibility.

Fields:

- `id`
- `campaign_id`
- `campaign_recipient_id`
- `attempt_number`
- `request_payload` JSON
- `response_payload` JSON
- `response_status_code`
- `error_message`
- `created_at`

This supports debugging batch failures without overloading the main recipient table.

## Backend Architecture

### API Layer

Add or expand campaign endpoints to support:

- create draft campaign
- update draft campaign
- upload campaign image
- preview campaign payload metadata
- start campaign rollout
- pause campaign rollout
- list campaign recipients with counts
- fetch campaign detail with delivery metrics

The create/update payloads should accept service ids from the frontend multi-select and should validate:

- at least one service is selected
- `discount_value` is required for `percent` and `flat`, forbidden for `none`
- `percent` is between `0` and `100`
- `flat` is non-negative
- `button_label` fits WhatsApp button limits
- uploaded image exists before launch if the creative requires an image

### Media Storage

Store uploaded files under:

- `uploads/campaigns/`

Backend should:

- create the directory if missing
- generate a safe unique file name
- store the local relative path in `campaigns.image_path`
- upload that image to Meta before the first batch send if `image_media_id` is missing
- cache `image_media_id` on the campaign for reuse

### Audience Resolution

Add a dedicated service that resolves recipients based on campaign audience config.

Inputs:

- campaign definition
- CRM customer/appointment data
- optional uploaded phone list

Outputs:

- deduplicated recipient rows
- normalized phone numbers
- optional display names

Deduplication rule:

- one phone number gets at most one recipient row per campaign

### Campaign Runner

Add a campaign execution service that:

1. validates the campaign is launchable
2. resolves the audience
3. inserts `campaign_recipients`
4. marks the campaign `running`
5. sends the first batch immediately
6. continues processing pending batches in the background
7. updates recipient delivery statuses and send logs
8. marks the campaign `completed` when no recipients remain pending
9. marks `failed` only for campaign-level failures that stop the run entirely

For v1, background execution can be implemented with `asyncio.create_task` from the app process if there is no existing job system. This is acceptable as a first release, but the code should be isolated behind a service boundary so it can later move to Celery/RQ/Temporal without changing API contracts.

### WhatsApp Sending

Extend `WhatsAppClient` with a helper for media-header interactive button messages so campaigns can send:

- image header
- body text
- footer text
- reply button with `booking_button_id`

If a campaign has no image, the runner can fall back to the existing text button message helper.

### Analytics

Campaign detail metrics should include:

- recipients total
- pending
- sent
- delivered
- read
- clicked
- failed
- bookings
- completed bookings
- cancelled bookings
- total service value
- total final value

Clicked can initially be inferred from a recipient whose phone triggered the campaign button id. This requires updating the booking entry handling path to stamp `clicked_at` on the matching recipient when a campaign journey starts.

## Frontend Design

### Campaign List

The `/campaigns` page should become a management page, not just a card list.

It needs:

- campaign table/cards with delivery status and top metrics
- `Create Campaign` action
- `View Details` action
- `Pause` action for running campaigns

### Campaign Builder

The builder should be a structured form with these sections:

1. Basics
   - name
   - code with slug helper
   - description

2. Offer Rules
   - service multi-select populated from `/services`
   - weekday selectors
   - valid from/to
   - per-user cap
   - discount type segmented control
   - constrained numeric input with helper text

3. Creative
   - image upload
   - image preview
   - message body
   - footer
   - button label
   - non-editable preview of resulting button id

4. Audience
   - radio/select for the four supported modes
   - inactivity days input when needed
   - phone list upload/paste area when needed

5. Launch
   - recipient estimate if feasible
   - `Start Campaign`

### Campaign Detail

Campaign detail should show:

- creative preview
- rule summary
- audience summary
- delivery counters
- booking/revenue metrics
- recipient table with delivery state

## Error Handling

- Invalid campaign configuration should block launch with actionable API errors.
- Partial recipient failures should mark only those recipients as failed, not the entire campaign.
- WhatsApp API failures must be persisted in send logs.
- If the app restarts during a run, pending recipients may stall in v1. This is acceptable if clearly isolated for later job-system hardening.

## Testing Strategy

### Backend

- campaign schema validation tests
- audience resolution tests for each supported audience mode
- deduplication and phone normalization tests
- image upload endpoint tests
- campaign launch tests that create recipients and mark campaign running
- batch runner tests with mocked `WhatsAppClient`
- recipient click stamping test when a campaign button is used
- delivery metrics aggregation tests

### Frontend

- form validation tests for discount and audience conditionals
- image upload interaction test
- service multi-select rendering test
- start campaign mutation flow test
- campaign detail metrics rendering test

## Non-Goals for V1

- scheduled send
- A/B testing
- multi-template campaign variants
- resume after process restart guarantees
- advanced segmentation beyond the four approved audience modes
- cloud object storage

## Open Implementation Choice

V1 can either:

1. keep using in-process background tasks for batch rollout, or
2. introduce a proper worker queue now

Recommendation: keep v1 in-process because it matches the current app architecture and gets to usable admin-controlled campaigns faster. The runner should still be encapsulated so a later worker migration is straightforward.
