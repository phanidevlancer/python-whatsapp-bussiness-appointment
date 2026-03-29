from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
import json

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.campaign import CampaignAudienceType, CampaignDiscountType, CampaignRunStatus, CampaignStatus
from app.models.campaign_recipient import CampaignDeliveryStatus


def _validate_weekdays(values: list[int] | None) -> list[int] | None:
    if values is None:
        return None

    invalid = [value for value in values if value < 0 or value > 6]
    if invalid:
        raise ValueError("allowed_weekdays must contain integers between 0 and 6")
    return values


def _validate_positive_integer(value: int | None, field_name: str, *, allow_zero: bool = False) -> int | None:
    if value is None:
        return None
    if allow_zero:
        if value < 0:
            raise ValueError(f"{field_name} must be greater than or equal to 0")
    elif value <= 0:
        raise ValueError(f"{field_name} must be greater than 0")
    return value


def _validate_discount_pair(
    discount_type: CampaignDiscountType | None,
    discount_value: Decimal | None,
) -> tuple[CampaignDiscountType | None, Decimal | None]:
    if discount_type is None:
        if discount_value is not None:
            raise ValueError("discount_type is required when discount_value is provided")
        return discount_type, discount_value

    if discount_type == CampaignDiscountType.NONE:
        if discount_value is not None:
            raise ValueError("discount_value must be omitted when discount_type is none")
        return discount_type, discount_value

    if discount_type == CampaignDiscountType.PERCENT:
        if discount_value is None:
            raise ValueError("discount_value is required when discount_type is percent")
        if discount_value < 0 or discount_value > 100:
            raise ValueError("discount_value must be between 0 and 100 when discount_type is percent")
        return discount_type, discount_value

    if discount_type == CampaignDiscountType.FLAT:
        if discount_value is None:
            raise ValueError("discount_value is required when discount_type is flat")
        if discount_value < 0:
            raise ValueError("discount_value must be greater than or equal to 0 when discount_type is flat")
        return discount_type, discount_value

    return discount_type, discount_value


def _validate_date_range(valid_from: datetime | None, valid_to: datetime | None) -> tuple[datetime | None, datetime | None]:
    if valid_from is None or valid_to is None:
        return valid_from, valid_to

    valid_from_is_aware = valid_from.tzinfo is not None and valid_from.utcoffset() is not None
    valid_to_is_aware = valid_to.tzinfo is not None and valid_to.utcoffset() is not None
    if valid_from_is_aware != valid_to_is_aware:
        raise ValueError("valid_from and valid_to must both be timezone-aware or both be naive datetimes")

    if valid_from > valid_to:
        raise ValueError("valid_from must be earlier than or equal to valid_to")
    return valid_from, valid_to


def _validate_json_serializable(value: object, field_name: str) -> object:
    try:
        json.dumps(value)
    except TypeError as exc:
        raise ValueError(f"{field_name} must be JSON-serializable") from exc
    return value


def _reject_bool(value: object, field_name: str) -> object:
    if isinstance(value, bool):
        raise ValueError(f"{field_name} must be an integer, not a boolean")
    return value


def _reject_bool_list(values: object, field_name: str) -> object:
    if isinstance(values, list) and any(isinstance(value, bool) for value in values):
        raise ValueError(f"{field_name} must contain integers, not booleans")
    return values


class CampaignPerformanceSourceComparison(BaseModel):
    source: str
    targeted: int = 0
    pending: int = 0
    sent: int = 0
    delivered: int = 0
    read: int = 0
    clicked: int = 0
    failed: int = 0
    bookings: int = 0
    confirmed: int = 0
    cancelled: int = 0
    completed: int = 0
    no_show: int = 0
    total_service_value: Decimal = Decimal("0.00")
    total_final_value: Decimal = Decimal("0.00")


class CampaignCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    booking_button_id: str | None = Field(default=None, max_length=120)
    allowed_service_ids: list[uuid.UUID] = Field(default_factory=list)
    allowed_weekdays: list[int] = Field(default_factory=list)
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    per_user_booking_limit: int | None = None
    discount_type: CampaignDiscountType = CampaignDiscountType.NONE
    discount_value: Decimal | None = None
    audience_type: CampaignAudienceType = CampaignAudienceType.ALL_CUSTOMERS
    audience_filters: dict[str, object] = Field(default_factory=dict)
    message_body: str | None = None
    message_footer: str | None = None
    button_label: str | None = None
    image_path: str | None = None
    batch_size: int | None = None
    batch_delay_seconds: int | None = None

    @field_validator("audience_filters", mode="before")
    @classmethod
    def validate_audience_filters(cls, value: object) -> object:
        return _validate_json_serializable(value, "audience_filters")

    @field_validator("allowed_weekdays", mode="before")
    @classmethod
    def validate_allowed_weekdays_input(cls, values: object) -> object:
        return _reject_bool_list(values, "allowed_weekdays")

    @field_validator("allowed_weekdays")
    @classmethod
    def validate_allowed_weekdays(cls, values: list[int]) -> list[int]:
        validated = _validate_weekdays(values)
        return validated if validated is not None else []

    @field_validator("per_user_booking_limit", mode="before")
    @classmethod
    def validate_per_user_booking_limit_input(cls, value: object) -> object:
        return _reject_bool(value, "per_user_booking_limit")

    @field_validator("per_user_booking_limit")
    @classmethod
    def validate_per_user_booking_limit(cls, value: int | None) -> int | None:
        return _validate_positive_integer(value, "per_user_booking_limit")

    @field_validator("batch_size", mode="before")
    @classmethod
    def validate_batch_size_input(cls, value: object) -> object:
        return _reject_bool(value, "batch_size")

    @field_validator("batch_size")
    @classmethod
    def validate_batch_size(cls, value: int | None) -> int | None:
        return _validate_positive_integer(value, "batch_size")

    @field_validator("batch_delay_seconds", mode="before")
    @classmethod
    def validate_batch_delay_seconds_input(cls, value: object) -> object:
        return _reject_bool(value, "batch_delay_seconds")

    @field_validator("batch_delay_seconds")
    @classmethod
    def validate_batch_delay_seconds(cls, value: int | None) -> int | None:
        return _validate_positive_integer(value, "batch_delay_seconds", allow_zero=True)

    @model_validator(mode="after")
    def validate_campaign_payload(self) -> "CampaignCreate":
        if not self.allowed_service_ids:
            raise ValueError("allowed_service_ids must include at least one service")

        _validate_date_range(self.valid_from, self.valid_to)
        _validate_discount_pair(self.discount_type, self.discount_value)
        return self


class CampaignUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    booking_button_id: str | None = Field(default=None, max_length=120)
    allowed_service_ids: list[uuid.UUID] | None = None
    allowed_weekdays: list[int] | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    per_user_booking_limit: int | None = None
    discount_type: CampaignDiscountType | None = None
    discount_value: Decimal | None = None
    status: CampaignStatus | None = None
    audience_type: CampaignAudienceType | None = None
    audience_filters: dict[str, object] | None = None
    message_body: str | None = None
    message_footer: str | None = None
    button_label: str | None = None
    image_path: str | None = None
    batch_size: int | None = None
    batch_delay_seconds: int | None = None

    @field_validator("audience_filters", mode="before")
    @classmethod
    def validate_audience_filters(cls, value: object) -> object:
        if value is None:
            return value
        return _validate_json_serializable(value, "audience_filters")

    @field_validator("allowed_weekdays", mode="before")
    @classmethod
    def validate_allowed_weekdays_input(cls, values: object) -> object:
        return _reject_bool_list(values, "allowed_weekdays")

    @field_validator("allowed_weekdays")
    @classmethod
    def validate_allowed_weekdays(cls, values: list[int] | None) -> list[int] | None:
        return _validate_weekdays(values)

    @field_validator("per_user_booking_limit", mode="before")
    @classmethod
    def validate_per_user_booking_limit_input(cls, value: object) -> object:
        return _reject_bool(value, "per_user_booking_limit")

    @field_validator("per_user_booking_limit")
    @classmethod
    def validate_per_user_booking_limit(cls, value: int | None) -> int | None:
        return _validate_positive_integer(value, "per_user_booking_limit")

    @field_validator("batch_size", mode="before")
    @classmethod
    def validate_batch_size_input(cls, value: object) -> object:
        return _reject_bool(value, "batch_size")

    @field_validator("batch_size")
    @classmethod
    def validate_batch_size(cls, value: int | None) -> int | None:
        return _validate_positive_integer(value, "batch_size")

    @field_validator("batch_delay_seconds", mode="before")
    @classmethod
    def validate_batch_delay_seconds_input(cls, value: object) -> object:
        return _reject_bool(value, "batch_delay_seconds")

    @field_validator("batch_delay_seconds")
    @classmethod
    def validate_batch_delay_seconds(cls, value: int | None) -> int | None:
        return _validate_positive_integer(value, "batch_delay_seconds", allow_zero=True)

    @model_validator(mode="after")
    def validate_campaign_payload(self) -> "CampaignUpdate":
        _validate_date_range(self.valid_from, self.valid_to)
        _validate_discount_pair(self.discount_type, self.discount_value)
        return self


class CampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    status: CampaignStatus
    audience_type: CampaignAudienceType
    audience_filters: dict[str, object]
    run_status: CampaignRunStatus | None = None
    message_body: str | None = None
    message_footer: str | None = None
    button_label: str | None = None
    image_path: str | None = None
    image_media_id: str | None = None
    batch_size: int | None = None
    batch_delay_seconds: int | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None
    last_error: str | None = None
    booking_button_id: str | None = None
    allowed_service_ids: list[uuid.UUID]
    allowed_weekdays: list[int]
    valid_from: datetime | None
    valid_to: datetime | None
    per_user_booking_limit: int | None
    discount_type: CampaignDiscountType
    discount_value: Decimal | None
    targeted: int = 0
    pending: int = 0
    sent: int = 0
    delivered: int = 0
    read: int = 0
    clicked: int = 0
    failed: int = 0
    bookings: int = 0
    confirmed: int = 0
    cancelled: int = 0
    completed: int = 0
    no_show: int = 0
    total_service_value: Decimal = Decimal("0.00")
    total_final_value: Decimal = Decimal("0.00")
    source_comparison: list[CampaignPerformanceSourceComparison] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CampaignPerformance(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    campaign_id: uuid.UUID | None
    campaign_code: str
    campaign_name: str
    run_status: CampaignRunStatus | None = None
    targeted: int = 0
    pending: int = 0
    sent: int = 0
    delivered: int = 0
    read: int = 0
    clicked: int = 0
    failed: int = 0
    bookings: int = 0
    confirmed: int = 0
    cancelled: int = 0
    completed: int = 0
    no_show: int = 0
    total_service_value: Decimal = Decimal("0.00")
    total_final_value: Decimal = Decimal("0.00")
    source_comparison: list[CampaignPerformanceSourceComparison] = Field(default_factory=list)


class CampaignSendLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    recipient_id: uuid.UUID
    provider_message_id: str | None = None
    status: CampaignDeliveryStatus
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    clicked_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class CampaignRecipientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    phone: str
    customer_name: str | None = None
    delivery_status: CampaignDeliveryStatus
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    clicked_at: datetime | None = None
    failed_at: datetime | None = None
    skipped_at: datetime | None = None
    last_error: str | None = None
    send_logs: list[CampaignSendLogRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
