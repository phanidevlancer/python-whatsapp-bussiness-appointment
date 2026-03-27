import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base
from app.models.appointment import AppointmentSource


class AppointmentStatusHistory(Base):
    __tablename__ = "appointment_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[AppointmentSource | None] = mapped_column(
        SQLEnum(AppointmentSource, name="appointmentsource", values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    reschedule_source: Mapped[AppointmentSource | None] = mapped_column(
        SQLEnum(AppointmentSource, name="appointmentsource", values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    appointment = relationship("Appointment", back_populates="status_history")
    changed_by = relationship("AdminUser", lazy="select")
