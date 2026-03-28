import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class LeadActivityType(str, enum.Enum):
    """Types of activities that can be logged for a lead."""
    
    STATUS_CHANGED = "status_changed"
    CALL_LOGGED = "call_logged"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    CONVERTED = "converted"
    NOTE_ADDED = "note_added"
    CREATED = "created"
    FOLLOW_UP_SCHEDULED = "follow_up_scheduled"
    SLA_BREACHED = "sla_breached"
    REASSIGNED = "reassigned"


class LeadActivity(Base):
    """
    Tracks all activities and changes for a lead.
    Provides a complete audit trail for compliance and analytics.
    """
    
    __tablename__ = "lead_activities"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("booking_drop_offs.id", ondelete="CASCADE"), nullable=False
    )
    
    activity_type: Mapped[LeadActivityType] = mapped_column(
        SQLEnum(LeadActivityType, name="leadactivitytype", values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    
    # Store previous and new values for tracking changes
    previous_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Additional notes or context
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Who performed this action (nullable for system-generated activities)
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    
    # Metadata for additional context (JSON-like data as text)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Relationships
    lead = relationship("BookingDropOff", foreign_keys=[lead_id], lazy="select", back_populates="activities")
    performed_by = relationship("AdminUser", foreign_keys=[performed_by_id], lazy="select")
    
    def __repr__(self) -> str:
        return (
            f"<LeadActivity lead_id={self.lead_id} type={self.activity_type.value} "
            f"performed_at={self.performed_at}>"
        )
