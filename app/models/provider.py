import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, Table, Column, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

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
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    services = relationship("Service", secondary="provider_service_map", lazy="select")
    appointments = relationship("Appointment", back_populates="provider", lazy="select")
