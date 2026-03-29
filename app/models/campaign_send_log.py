from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.campaign_recipient import CampaignDeliveryStatus


class CampaignSendLog(Base):
    __tablename__ = "campaign_send_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaign_recipients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_message_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    status: Mapped[CampaignDeliveryStatus] = mapped_column(
        SQLEnum(CampaignDeliveryStatus, name="campaigndeliverystatus", values_callable=lambda x: [e.value for e in x]),
        default=CampaignDeliveryStatus.PENDING,
        nullable=False,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    campaign = relationship("Campaign", back_populates="send_logs", lazy="select")
    recipient = relationship("CampaignRecipient", back_populates="send_logs", lazy="select")

    def __repr__(self) -> str:
        return f"<CampaignSendLog id={self.id} status={self.status.value}>"
