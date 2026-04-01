import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

if TYPE_CHECKING:
    from app.models.time_slot import TimeSlot

provider_service_map = Table(
    "provider_service_map",
    Base.metadata,
    Column("provider_id", UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), primary_key=True),
    Column("service_id", UUID(as_uuid=True), ForeignKey("services.id", ondelete="CASCADE"), primary_key=True),
)

class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, server_default="doctor")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="20")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    services = relationship("Service", secondary="provider_service_map", lazy="select")
    time_slots: Mapped[list["TimeSlot"]] = relationship("TimeSlot", back_populates="provider", lazy="select")
    appointments = relationship("Appointment", back_populates="provider", lazy="select")
