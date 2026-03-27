from app.db.base_class import Base  # noqa: F401

# Import all models here so Alembic autogenerate can discover them.
# Order matters: models with FKs must come after the tables they reference.
from app.models.service import Service          # noqa: F401
from app.models.time_slot import TimeSlot       # noqa: F401
from app.models.appointment import Appointment  # noqa: F401
from app.models.user_session import UserSession # noqa: F401
