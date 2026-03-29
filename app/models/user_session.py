import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class SessionStep(str, enum.Enum):
    START = "START"
    SERVICE_SELECTED = "SERVICE_SELECTED"
    SLOT_SELECTED = "SLOT_SELECTED"
    BOOKED = "BOOKED"
    AWAITING_NAME = "AWAITING_NAME"
    AWAITING_EMAIL = "AWAITING_EMAIL"
    UPDATING_NAME = "UPDATING_NAME"
    MANAGE_MENU = "MANAGE_MENU"
    MANAGE_APPOINTMENT = "MANAGE_APPOINTMENT"
    RESCHEDULE_SLOT = "RESCHEDULE_SLOT"


class JourneyType(str, enum.Enum):
    ORGANIC = "organic"
    CAMPAIGN = "campaign"


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # One row per user phone number
    user_phone: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True, index=True
    )
    current_step: Mapped[SessionStep] = mapped_column(
        SQLEnum(SessionStep, name="sessionstep"),
        default=SessionStep.START,
        nullable=False,
    )
    selected_service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id"), nullable=True
    )
    selected_slot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("time_slots.id"), nullable=True
    )
    selected_appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True
    )
    active_journey_type: Mapped[JourneyType] = mapped_column(
        SQLEnum(JourneyType, name="journeytype", values_callable=lambda x: [e.value for e in x]),
        default=JourneyType.ORGANIC,
        nullable=False,
    )
    active_campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True
    )
    journey_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    journey_entry_point: Mapped[str | None] = mapped_column(String(50), nullable=True)
    journey_entry_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    active_campaign = relationship("Campaign", foreign_keys=[active_campaign_id], back_populates="sessions", lazy="select")

    def __repr__(self) -> str:
        return f"<UserSession phone={self.user_phone} step={self.current_step}>"
