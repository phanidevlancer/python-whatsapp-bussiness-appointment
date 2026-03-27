import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class SessionStep(str, enum.Enum):
    START = "START"
    SERVICE_SELECTED = "SERVICE_SELECTED"
    SLOT_SELECTED = "SLOT_SELECTED"
    BOOKED = "BOOKED"
    AWAITING_NAME = "AWAITING_NAME"
    AWAITING_EMAIL = "AWAITING_EMAIL"
    MANAGE_MENU = "MANAGE_MENU"
    MANAGE_APPOINTMENT = "MANAGE_APPOINTMENT"
    RESCHEDULE_SLOT = "RESCHEDULE_SLOT"


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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<UserSession phone={self.user_phone} step={self.current_step}>"
