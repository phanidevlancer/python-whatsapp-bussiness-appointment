import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class LeadStatus(str, enum.Enum):
    NEW_LEAD = "new_lead"
    CONTACTED = "contacted"
    FOLLOW_UP = "follow_up"
    CONVERTED = "converted"
    LOST = "lost"


class CustomerType(str, enum.Enum):
    PROSPECT = "prospect"        # Never booked before
    RETURNING = "returning"      # Has prior confirmed/completed appointments
    RE_ENGAGED = "re_engaged"    # Was a lead before, never converted, came back


class BookingDropOff(Base):
    __tablename__ = "booking_drop_offs"
    __table_args__ = (
        Index("ix_booking_drop_offs_phone", "phone"),
        Index("ix_booking_drop_offs_status", "status"),
        Index("ix_booking_drop_offs_customer_type", "customer_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    dropped_at_step: Mapped[str] = mapped_column(String(50), nullable=False)
    selected_service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id", ondelete="SET NULL"), nullable=True
    )
    selected_slot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("time_slots.id", ondelete="SET NULL"), nullable=True
    )
    session_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    dropped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[LeadStatus] = mapped_column(
        SQLEnum(LeadStatus, name="leadstatus", values_callable=lambda x: [e.value for e in x]),
        default=LeadStatus.NEW_LEAD,
        nullable=False,
    )
    customer_type: Mapped[CustomerType] = mapped_column(
        SQLEnum(CustomerType, name="customertype", values_callable=lambda x: [e.value for e in x]),
        default=CustomerType.PROSPECT,
        nullable=False,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    crm_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    converted_appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    
    # SLA tracking fields
    first_contacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_contacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    follow_up_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    # Lead scoring
    priority_score: Mapped[int | None] = mapped_column(default=0, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    customer = relationship("Customer", foreign_keys=[customer_id], lazy="select")
    service = relationship("Service", foreign_keys=[selected_service_id], lazy="select")
    slot = relationship("TimeSlot", foreign_keys=[selected_slot_id], lazy="select")
    assigned_to = relationship("AdminUser", foreign_keys=[assigned_to_id], lazy="select")
    converted_appointment = relationship("Appointment", foreign_keys=[converted_appointment_id], lazy="select")
    activities = relationship("LeadActivity", foreign_keys="LeadActivity.lead_id", back_populates="lead", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<BookingDropOff phone={self.phone} step={self.dropped_at_step} status={self.status}>"
