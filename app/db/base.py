from app.db.base_class import Base  # noqa: F401

# Import all models here so Alembic autogenerate can discover them.
# Order matters: models with FKs must come after the tables they reference.
from app.models.service import Service                                          # noqa: F401
from app.models.time_slot import TimeSlot                                       # noqa: F401
from app.models.campaign import Campaign                                        # noqa: F401
from app.models.customer import Customer                                        # noqa: F401
from app.models.campaign_recipient import CampaignRecipient                    # noqa: F401
from app.models.campaign_send_log import CampaignSendLog                        # noqa: F401
from app.models.appointment import Appointment                                  # noqa: F401
from app.models.user_session import UserSession                                 # noqa: F401
from app.models.admin_user import AdminUser                                     # noqa: F401
from app.models.provider import Provider                                        # noqa: F401
from app.models.permission import Permission                                    # noqa: F401
from app.models.role_template import RoleTemplate, role_template_permissions     # noqa: F401
from app.models.appointment_status_history import AppointmentStatusHistory     # noqa: F401
from app.models.whatsapp_message_log import WhatsAppMessageLog                 # noqa: F401
from app.models.audit_log import AuditLog                                       # noqa: F401
from app.models.entity_change_history import EntityChangeHistory                 # noqa: F401
from app.models.lead_activity import LeadActivity                               # noqa: F401
from app.models.booking_drop_off import BookingDropOff                           # noqa: F401
from app.models.user_audit_log import UserAuditLog                              # noqa: F401
