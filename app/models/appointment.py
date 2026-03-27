import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class AppointmentSource(str, enum.Enum):
    WHATSAPP = "whatsapp"
    ADMIN_DASHBOARD = "admin_dashboard"


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        # Partial unique index: only one CONFIRMED appointment per slot.
        # Cancelled appointments don't block rebooking the same slot.
        Index(
            "uq_appointments_slot_confirmed",
            "slot_id",
            unique=True,
            postgresql_where="status = 'CONFIRMED'",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_phone: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id"), nullable=False
    )
    # Double-booking prevented by partial unique index (uq_appointments_slot_confirmed)
    # which enforces uniqueness only for status='confirmed', allowing rebooking after cancellation.
    slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("time_slots.id"), nullable=False
    )
    provider_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("providers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancellation_source: Mapped[AppointmentSource | None] = mapped_column(
        SQLEnum(AppointmentSource, name="appointmentsource", values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    rescheduled_from_slot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("time_slots.id"), nullable=True
    )
    reschedule_source: Mapped[AppointmentSource | None] = mapped_column(
        SQLEnum(AppointmentSource, name="appointmentsource", values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        SQLEnum(AppointmentStatus, name="appointmentstatus", values_callable=lambda x: [e.value for e in x]),
        default=AppointmentStatus.CONFIRMED,
        nullable=False,
    )
    source: Mapped[AppointmentSource] = mapped_column(
        SQLEnum(AppointmentSource, name="appointmentsource", values_callable=lambda x: [e.value for e in x]),
        default=AppointmentSource.ADMIN_DASHBOARD,
        nullable=False,
    )
    booked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    service = relationship("Service", foreign_keys=[service_id], lazy="select")
    slot = relationship("TimeSlot", foreign_keys=[slot_id], lazy="select")
    provider = relationship("Provider", foreign_keys=[provider_id], back_populates="appointments", lazy="select")
    customer = relationship("Customer", foreign_keys=[customer_id], lazy="select")
    status_history = relationship("AppointmentStatusHistory", back_populates="appointment", lazy="select")

    def __repr__(self) -> str:
        return f"<Appointment id={self.id} phone={self.user_phone} status={self.status}>"
