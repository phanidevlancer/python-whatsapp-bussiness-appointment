import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, func, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class MessageLogStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"

class WhatsAppMessageLog(Base):
    __tablename__ = "whatsapp_message_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(String(100), nullable=False)
    template_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[MessageLogStatus] = mapped_column(SQLEnum(MessageLogStatus, name="messagelogstatus", values_callable=lambda x: [e.value for e in x]), default=MessageLogStatus.PENDING, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
