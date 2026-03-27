import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class AdminRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    RECEPTIONIST = "receptionist"

class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[AdminRole] = mapped_column(SQLEnum(AdminRole, name="adminrole", values_callable=lambda x: [e.value for e in x]), default=AdminRole.RECEPTIONIST, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
