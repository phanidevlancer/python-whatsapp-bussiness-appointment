import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.provider import Provider


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_booked: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    booked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("uq_time_slots_provider_start", "provider_id", "start_time", unique=True),
        Index("ix_time_slots_provider_available", "provider_id", "is_booked", "start_time"),
    )

    # Relationships
    provider: Mapped["Provider"] = relationship("Provider", back_populates="time_slots", lazy="select")

    def __repr__(self) -> str:
        return f"<TimeSlot id={self.id} provider_id={self.provider_id} start={self.start_time}>"
