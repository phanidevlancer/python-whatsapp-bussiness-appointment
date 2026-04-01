from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.base  # noqa: F401

from app.db.session import AsyncSessionLocal
from app.models.admin_user import AdminUser, AdminRole
from app.models.campaign import Campaign, CampaignDiscountType, CampaignStatus
from app.models.provider import Provider, provider_service_map
from app.models.service import Service
from app.repositories import permission_repository as perm_repo
from app.repositories import role_template_repository as template_repo

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PermissionSpec:
    module: str
    action: str
    description: str

    @property
    def code(self) -> str:
        return f"{self.module}.{self.action}"


PERMISSION_SPECS: tuple[PermissionSpec, ...] = (
    PermissionSpec("dashboard", "view", "View dashboard analytics"),
    PermissionSpec("appointments", "view", "View appointments"),
    PermissionSpec("appointments", "create", "Create appointments"),
    PermissionSpec("appointments", "update", "Edit appointment details"),
    PermissionSpec("appointments", "delete", "Delete appointments"),
    PermissionSpec("appointments", "reschedule", "Reschedule appointments"),
    PermissionSpec("appointments", "cancel", "Cancel appointments"),
    PermissionSpec("appointments", "export", "Export appointment data"),
    PermissionSpec("customers", "view", "View customers"),
    PermissionSpec("customers", "create", "Create customers"),
    PermissionSpec("customers", "update", "Edit customer details"),
    PermissionSpec("customers", "delete", "Delete customers"),
    PermissionSpec("customers", "export", "Export customer data"),
    PermissionSpec("customers", "partial_update_contact", "Update safe customer contact fields"),
    PermissionSpec("services", "view", "View services"),
    PermissionSpec("services", "create", "Create services"),
    PermissionSpec("services", "update", "Edit services"),
    PermissionSpec("services", "delete", "Delete services"),
    PermissionSpec("services", "manage", "Manage services"),
    PermissionSpec("providers", "view", "View providers"),
    PermissionSpec("providers", "create", "Create providers"),
    PermissionSpec("providers", "update", "Edit providers"),
    PermissionSpec("providers", "delete", "Delete providers"),
    PermissionSpec("providers", "manage", "Manage providers"),
    PermissionSpec("slots", "view", "View slots"),
    PermissionSpec("slots", "create", "Create slots"),
    PermissionSpec("slots", "update", "Edit slots"),
    PermissionSpec("slots", "delete", "Delete slots"),
    PermissionSpec("slots", "manage", "Manage slots"),
    PermissionSpec("leads", "view", "View leads"),
    PermissionSpec("leads", "update", "Edit leads"),
    PermissionSpec("leads", "assign", "Assign leads"),
    PermissionSpec("leads", "export", "Export leads"),
    PermissionSpec("notifications", "view", "View notifications"),
    PermissionSpec("notifications", "manage", "Manage notifications"),
    PermissionSpec("users", "view", "View users"),
    PermissionSpec("users", "create", "Create users"),
    PermissionSpec("users", "update", "Edit users"),
    PermissionSpec("users", "delete", "Delete users"),
    PermissionSpec("users", "manage", "Manage users"),
    PermissionSpec("roles", "view", "View role templates"),
    PermissionSpec("roles", "create", "Create role templates"),
    PermissionSpec("roles", "update", "Edit role templates"),
    PermissionSpec("roles", "delete", "Delete role templates"),
    PermissionSpec("roles", "manage", "Manage role templates"),
    PermissionSpec("reports", "view", "View reports"),
    PermissionSpec("reports", "export", "Export reports"),
    PermissionSpec("settings", "view", "View settings"),
    PermissionSpec("settings", "manage", "Manage settings"),
)

SYSTEM_TEMPLATES: tuple[dict[str, object], ...] = (
    {
        "name": "Super Admin",
        "description": "Full access to all permissions",
        "is_system": True,
        "permission_codes": tuple(spec.code for spec in PERMISSION_SPECS),
    },
    {
        "name": "Admin",
        "description": "Administrative access with a few restricted actions",
        "is_system": True,
        "permission_codes": tuple(
            spec.code
            for spec in PERMISSION_SPECS
            if spec.code not in {"users.delete", "roles.delete", "settings.manage"}
        ),
    },
    {
        "name": "Receptionist",
        "description": "Front desk and booking workflow access",
        "is_system": True,
        "permission_codes": (
            "dashboard.view",
            "appointments.view",
            "appointments.create",
            "appointments.update",
            "appointments.reschedule",
            "appointments.cancel",
            "customers.view",
            "customers.partial_update_contact",
            "slots.view",
            "notifications.view",
        ),
    },
    {
        "name": "Viewer",
        "description": "Read-only and reporting access",
        "is_system": True,
        "permission_codes": (
            "dashboard.view",
            "appointments.view",
            "appointments.export",
            "customers.view",
            "customers.export",
            "services.view",
            "providers.view",
            "reports.view",
            "reports.export",
            "leads.view",
        ),
    },
    {
        "name": "Operations Manager",
        "description": "Operational access for day-to-day clinic management",
        "is_system": True,
        "permission_codes": (
            "dashboard.view",
            "appointments.view",
            "appointments.create",
            "appointments.update",
            "appointments.reschedule",
            "appointments.cancel",
            "appointments.export",
            "customers.view",
            "customers.create",
            "customers.update",
            "customers.export",
            "customers.partial_update_contact",
            "services.view",
            "providers.view",
            "providers.update",
            "slots.view",
            "slots.create",
            "slots.update",
            "slots.manage",
            "leads.view",
            "leads.update",
            "leads.assign",
            "leads.export",
            "notifications.view",
            "notifications.manage",
            "reports.view",
            "reports.export",
        ),
    },
)

LEGACY_ROLE_TO_TEMPLATE = {
    AdminRole.ADMIN: "Admin",
    AdminRole.MANAGER: "Operations Manager",
    AdminRole.RECEPTIONIST: "Receptionist",
}


def _normalize_legacy_role(role: AdminRole | str | None) -> AdminRole | str | None:
    if role is None:
        return None
    if isinstance(role, AdminRole):
        return role
    for member in AdminRole:
        if member.value == role:
            return member
    return role


async def seed_permissions(db) -> list:
    seeded = []
    for spec in PERMISSION_SPECS:
        permission, _ = await perm_repo.upsert_permission(
            db,
            module=spec.module,
            action=spec.action,
            code=spec.code,
            description=spec.description,
        )
        seeded.append(permission)
    return seeded


async def seed_system_templates(db) -> dict[str, object]:
    permissions_by_code = {permission.code: permission for permission in await perm_repo.list_permissions(db)}
    seeded_templates: dict[str, object] = {}

    for template_spec in SYSTEM_TEMPLATES:
        template, _ = await template_repo.upsert_template(
            db,
            name=str(template_spec["name"]),
            description=str(template_spec["description"]),
            is_system=bool(template_spec["is_system"]),
            is_active=True,
        )
        permission_codes = tuple(template_spec["permission_codes"])
        missing_codes = [code for code in permission_codes if code not in permissions_by_code]
        if missing_codes:
            raise RuntimeError(
                f"Cannot seed template {template_spec['name']}: missing permissions {missing_codes}"
            )
        template_permissions = [permissions_by_code[code] for code in permission_codes]
        await template_repo.set_template_permissions(db, template.id, template_permissions)
        seeded_templates[template.name] = template

    return seeded_templates


async def backfill_legacy_admin_templates(db) -> int:
    templates_by_name = {template.name: template for template in await template_repo.list_templates(db)}
    updated = 0

    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at))
    for user in result.scalars().all():
        if getattr(user, "template_id", None):
            continue
        template_name = LEGACY_ROLE_TO_TEMPLATE.get(_normalize_legacy_role(user.role))
        if template_name is None:
            continue
        template = templates_by_name.get(template_name)
        if template is None:
            continue
        user.template_id = template.id
        updated += 1

    if updated:
        await db.flush()

    return updated


async def seed_test_campaigns(db: AsyncSession) -> None:
    service_result = await db.execute(select(Service.id, Service.name))
    service_ids_by_name = {name: str(service_id) for service_id, name in service_result.all()}

    campaign_specs = (
        {
            "code": "diwali-hydra-50-sun",
            "name": "Diwali Hydra 50",
            "description": "Hydra facial at 50% off on Sundays",
            "booking_button_id": "campaign_book:diwali-hydra-50-sun",
            "allowed_service_ids": [service_ids_by_name["Hydra Facial"]] if "Hydra Facial" in service_ids_by_name else [],
            "allowed_weekdays": [6],
            "per_user_booking_limit": 1,
            "discount_type": CampaignDiscountType.PERCENT,
            "discount_value": 50,
            "status": CampaignStatus.ACTIVE,
        },
        {
            "code": "weekday-consult-20",
            "name": "Weekday Consult 20",
            "description": "Flat Rs 20 off weekday consultations",
            "booking_button_id": "campaign_book:weekday-consult-20",
            "allowed_service_ids": [service_ids_by_name["General Consultation"]] if "General Consultation" in service_ids_by_name else [],
            "allowed_weekdays": [0, 1, 2, 3, 4],
            "per_user_booking_limit": 2,
            "discount_type": CampaignDiscountType.FLAT,
            "discount_value": 20,
            "status": CampaignStatus.ACTIVE,
        },
    )

    for spec in campaign_specs:
        existing = await db.execute(select(Campaign).where(Campaign.code == spec["code"]))
        campaign = existing.scalar_one_or_none()
        if campaign is None:
            campaign = Campaign(**spec)
            db.add(campaign)
        else:
            for key, value in spec.items():
                setattr(campaign, key, value)

    await db.flush()


async def seed_default_providers(db: AsyncSession) -> None:
    """Seed a default provider for each service so WhatsApp booking works out of the box."""
    service_result = await db.execute(select(Service.id, Service.name).where(Service.is_active == True))  # noqa: E712
    services = service_result.all()
    if not services:
        return

    # One default doctor provider that covers all active services
    existing = await db.execute(select(Provider).where(Provider.email == "default.doctor@clinic.com"))
    provider = existing.scalar_one_or_none()
    if provider is None:
        provider = Provider(
            name="Default Doctor",
            role="doctor",
            email="default.doctor@clinic.com",
            is_active=True,
        )
        db.add(provider)
        await db.flush()

    # Assign all active services to this provider (idempotent)
    existing_map = await db.execute(
        provider_service_map.select().where(provider_service_map.c.provider_id == provider.id)
    )
    already_assigned = {row.service_id for row in existing_map.fetchall()}
    for service_id, _ in services:
        if service_id not in already_assigned:
            await db.execute(
                provider_service_map.insert().values(provider_id=provider.id, service_id=service_id)
            )
    await db.flush()


async def run_seed(db: AsyncSession | None = None) -> None:
    if db is None:
        async with AsyncSessionLocal() as session:
            await _run_seed(session)
    else:
        await _run_seed(db)


async def _run_seed(db: AsyncSession) -> None:
    logger.info("Seeding RBAC permissions and role templates")
    await seed_permissions(db)
    await seed_system_templates(db)
    updated = await backfill_legacy_admin_templates(db)
    await seed_test_campaigns(db)
    await seed_default_providers(db)
    await db.commit()
    logger.info("RBAC seed complete; backfilled %s legacy admin users", updated)


def main() -> None:
    asyncio.run(run_seed())


if __name__ == "__main__":
    main()
