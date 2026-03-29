from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class CampaignStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    EXPIRED = "expired"


class CampaignRunStatus(str, enum.Enum):
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


class CampaignDiscountType(str, enum.Enum):
    NONE = "none"
    PERCENT = "percent"
    FLAT = "flat"


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(
        SQLEnum(CampaignStatus, name="campaignstatus", values_callable=lambda x: [e.value for e in x]),
        default=CampaignStatus.ACTIVE,
        nullable=False,
    )
    audience_type: Mapped[CampaignAudienceType] = mapped_column(
        SQLEnum(CampaignAudienceType, name="campaignaudiencetype", values_callable=lambda x: [e.value for e in x]),
        default=CampaignAudienceType.ALL_CUSTOMERS,
        nullable=False,
    )
    audience_filters: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    message_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_footer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    button_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_media_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    batch_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    batch_delay_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    booking_button_id: Mapped[str | None] = mapped_column(String(120), nullable=True, unique=True, index=True)
    allowed_service_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    allowed_weekdays: Mapped[list[int]] = mapped_column(JSONB, default=list, nullable=False)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    per_user_booking_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discount_type: Mapped[CampaignDiscountType] = mapped_column(
        SQLEnum(CampaignDiscountType, name="campaigndiscounttype", values_callable=lambda x: [e.value for e in x]),
        default=CampaignDiscountType.NONE,
        nullable=False,
    )
    discount_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    appointments = relationship("Appointment", back_populates="campaign", lazy="select")
    sessions = relationship("UserSession", back_populates="active_campaign", lazy="select")
    recipients = relationship("CampaignRecipient", back_populates="campaign", lazy="select", cascade="all, delete-orphan")
    send_logs = relationship("CampaignSendLog", back_populates="campaign", lazy="select", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Campaign id={self.id} code={self.code!r} status={self.status.value}>"
