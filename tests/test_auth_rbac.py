from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
import inspect
import uuid

import pytest
from fastapi import HTTPException
from fastapi.params import Depends as DependsParam
from pydantic import ValidationError

from app.api.v1 import appointments as appointments_api
from app.api.v1 import customers as customers_api
from app.api.v1 import dashboard as dashboard_api
from app.api.v1 import leads_analytics as leads_analytics_api
from app.api.v1 import notifications as notifications_api
from app.api.v1 import providers as providers_api
from app.api.v1 import services as services_api
from app.api.v1 import slots as slots_api
from app.core.deps import require_permission, require_admin, require_manager_or_above
from app.core import permissions as permissions_module
from app.core.security import create_access_token, decode_access_token, hash_password
from app.db.base import Base
from app.models.admin_user import AdminUser, AdminRole
from app.models.appointment import Appointment
from app.models.permission import Permission
from app.models.role_template import RoleTemplate, role_template_permissions
from app.models.user_audit_log import UserAuditLog
from app.repositories import customer_repository
from app.schemas.admin_user import AdminUserCreate, CurrentUserResponse, TokenResponse
from app.schemas.appointment_crm import AppointmentStatusHistoryRead
from app.schemas.customer import CustomerContactUpdate
from app.schemas.entity_change_history import EntityChangeHistoryRead
from app.schemas.user_management import validate_password_strength
from app.services import auth_service


def test_rbac_tables_are_registered_in_metadata() -> None:
    expected_tables = {
        "admin_users",
        "permissions",
        "role_templates",
        "role_template_permissions",
        "user_audit_log",
    }

    assert expected_tables.issubset(Base.metadata.tables.keys())


def test_admin_user_has_legacy_role_and_new_rbac_columns() -> None:
    columns = set(AdminUser.__table__.c.keys())

    assert {"role", "template_id", "employee_code", "phone", "is_first_login", "must_change_password", "last_login_at", "created_by", "updated_by", "failed_login_attempts", "locked_until"}.issubset(columns)
    assert AdminUser.__table__.c.role.type.enums == [role.value for role in AdminRole]


def test_role_template_permissions_table_has_expected_shape() -> None:
    columns = set(role_template_permissions.c.keys())
    unique_constraints = {
        tuple(sorted(constraint.columns.keys()))
        for constraint in role_template_permissions.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }

    assert {"id", "template_id", "permission_id"}.issubset(columns)
    assert ("permission_id", "template_id") in unique_constraints or ("template_id", "permission_id") in unique_constraints


def test_rbac_model_classes_are_importable() -> None:
    assert Permission.__tablename__ == "permissions"
    assert RoleTemplate.__tablename__ == "role_templates"
    assert UserAuditLog.__tablename__ == "user_audit_log"


def test_user_management_schemas_expose_expected_shape() -> None:
    create_user = AdminUserCreate(
        email="test@example.com",
        password="ValidPass1!",
        name="Test User",
    )
    assert create_user.role == AdminRole.RECEPTIONIST

    token = TokenResponse(
        access_token="token",
        user={
            "id": str(uuid.uuid4()),
            "email": "test@example.com",
            "name": "Test User",
            "role": AdminRole.RECEPTIONIST,
            "template_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        },
    )
    assert token.must_change_password is False
    assert token.permissions == []

    current = CurrentUserResponse(
        user=token.user,
        permissions=["dashboard.view"],
        must_change_password=True,
    )
    assert current.must_change_password is True


def test_customer_contact_update_schema_is_restricted() -> None:
    payload = CustomerContactUpdate(phone="1234567890", email="contact@example.com")

    assert payload.model_dump(exclude_none=True) == {
        "phone": "1234567890",
        "email": "contact@example.com",
    }

    with pytest.raises(ValidationError):
        CustomerContactUpdate(phone="1234567890", name="Not allowed")


def _permission_code_from_endpoint(endpoint, expected_code: str) -> str:
    codes: list[str] = []
    for param in inspect.signature(endpoint).parameters.values():
        default = param.default
        if not isinstance(default, DependsParam):
            continue
        dependency = default.dependency
        if dependency is None or not dependency.__closure__:
            continue
        for cell in dependency.__closure__:
            if isinstance(cell.cell_contents, str):
                codes.append(cell.cell_contents)
                if cell.cell_contents == expected_code:
                    return expected_code
    raise AssertionError(f"{endpoint.__name__} did not include {expected_code}; saw {codes}")


def test_task7_routes_use_explicit_permission_dependencies() -> None:
    expectations = {
        slots_api.list_slots: "slots.view",
        slots_api.generate_slots: "slots.create",
        slots_api.block_slot: "slots.update",
        slots_api.unblock_slot: "slots.update",
        services_api.list_services: "services.view",
        services_api.create_service: "services.create",
        services_api.update_service: "services.update",
        services_api.deactivate_service: "services.delete",
        providers_api.list_providers: "providers.view",
        providers_api.create_provider: "providers.create",
        providers_api.update_provider: "providers.update",
        providers_api.assign_service_to_provider: "providers.manage",
        providers_api.remove_service_from_provider: "providers.manage",
        dashboard_api.get_stats: "dashboard.view",
        dashboard_api.get_trends: "dashboard.view",
        appointments_api.list_appointments: "appointments.view",
        appointments_api.create_appointment: "appointments.create",
        appointments_api.update_appointment: "appointments.update",
        appointments_api.reschedule_appointment: "appointments.reschedule",
        appointments_api.cancel_appointment: "appointments.cancel",
        appointments_api.complete_appointment: "appointments.update",
        appointments_api.no_show_appointment: "appointments.update",
        leads_analytics_api.get_lead_metrics: "reports.view",
        leads_analytics_api.get_lead_trend: "reports.view",
        leads_analytics_api.get_agent_performance: "reports.view",
        leads_analytics_api.get_drop_off_analysis: "reports.view",
        leads_analytics_api.get_complete_analytics: "reports.view",
        notifications_api.list_notification_logs: "notifications.view",
        notifications_api.resend_notification: "notifications.manage",
    }

    for endpoint, expected_code in expectations.items():
        assert _permission_code_from_endpoint(endpoint, expected_code) == expected_code


def test_validate_password_strength_rejects_weak_password() -> None:
    with pytest.raises(ValueError):
        validate_password_strength("weak")


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool = False):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def get(self, key: str):
        return self.store.get(key)

    async def exists(self, key: str):
        return 1 if key in self.store else 0

    async def delete(self, key: str):
        self.store.pop(key, None)


class FakeDB:
    def __init__(self) -> None:
        self.flush_count = 0

    async def execute(self, statement):
        raise AssertionError("execute should not be called in this test")

    async def flush(self):
        self.flush_count += 1


def test_create_access_token_includes_jti_and_permissions_hash() -> None:
    token = create_access_token(
        subject="user-123",
        role="admin",
        jti="jti-123",
        perms_hash="permhash-123",
    )
    payload = decode_access_token(token)

    assert payload["sub"] == "user-123"
    assert payload["role"] == "admin"
    assert payload["jti"] == "jti-123"
    assert payload["perms_hash"] == "permhash-123"


@pytest.mark.asyncio
async def test_blacklist_helpers_round_trip() -> None:
    redis = FakeRedis()

    assert await permissions_module.is_token_blacklisted(redis, "token-1") is False
    await permissions_module.blacklist_token(
        redis,
        "token-1",
        expires_at=datetime.now(timezone.utc),
    )
    assert await permissions_module.is_token_blacklisted(redis, "token-1") is True


@pytest.mark.asyncio
async def test_get_user_permissions_uses_legacy_role_fallback_and_caches() -> None:
    redis = FakeRedis()
    user = SimpleNamespace(id=uuid.uuid4(), role=AdminRole.MANAGER, template_id=None)
    db = FakeDB()

    permissions = await permissions_module.get_user_permissions(db, redis, user)

    assert "appointments.cancel" in permissions
    cached = await permissions_module.get_cached_permissions(redis, user.id)
    assert cached is not None
    assert "appointments.cancel" in cached


@pytest.mark.asyncio
async def test_legacy_admin_and_manager_permissions_include_dashboard_access() -> None:
    redis = FakeRedis()
    db = FakeDB()

    admin_user = SimpleNamespace(id=uuid.uuid4(), role=AdminRole.ADMIN, template_id=None)
    manager_user = SimpleNamespace(id=uuid.uuid4(), role=AdminRole.MANAGER, template_id=None)

    admin_permissions = await permissions_module.get_user_permissions(db, redis, admin_user)
    manager_permissions = await permissions_module.get_user_permissions(db, redis, manager_user)

    assert "dashboard.view" in admin_permissions
    assert "users.view" in admin_permissions
    assert "roles.view" in admin_permissions
    assert "dashboard.view" in manager_permissions
    assert "reports.view" in manager_permissions


@pytest.mark.asyncio
async def test_login_locks_account_after_five_failed_attempts(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email="lock@example.com",
        hashed_password=hash_password("ValidPass1!"),
        name="Lock User",
        role=AdminRole.ADMIN,
        is_active=True,
        failed_login_attempts=4,
        locked_until=None,
        last_login_at=None,
        is_first_login=False,
        must_change_password=False,
    )

    async def fake_get_by_email(_db, email):
        assert email == user.email
        return user

    monkeypatch.setattr(auth_service.admin_repo, "get_by_email", fake_get_by_email)

    with pytest.raises(HTTPException) as exc:
        await auth_service.login(FakeDB(), user.email, "WrongPass1!")

    assert exc.value.status_code == 401
    assert user.failed_login_attempts == 5
    assert user.locked_until is not None


@pytest.mark.asyncio
async def test_login_resets_failed_attempts_and_sets_last_login(monkeypatch: pytest.MonkeyPatch) -> None:
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email="ok@example.com",
        hashed_password=hash_password("ValidPass1!"),
        name="Ok User",
        role=AdminRole.ADMIN,
        is_active=True,
        failed_login_attempts=3,
        locked_until=datetime.now(timezone.utc) - timedelta(minutes=1),
        last_login_at=None,
        is_first_login=False,
        must_change_password=False,
    )

    async def fake_get_by_email(_db, email):
        assert email == user.email
        return user

    monkeypatch.setattr(auth_service.admin_repo, "get_by_email", fake_get_by_email)

    result = await auth_service.login(FakeDB(), user.email, "ValidPass1!")

    assert result is user
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.last_login_at is not None


@pytest.mark.asyncio
async def test_change_password_updates_first_login_flags() -> None:
    db = FakeDB()
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email="change@example.com",
        hashed_password=hash_password("ValidPass1!"),
        name="Change User",
        role=AdminRole.RECEPTIONIST,
        is_active=True,
        failed_login_attempts=2,
        locked_until=datetime.now(timezone.utc),
        is_first_login=True,
        must_change_password=True,
    )

    updated = await auth_service.change_password(db, user, "ValidPass1!", "NewPass1!")

    assert updated is user
    assert user.is_first_login is False
    assert user.must_change_password is False
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert db.flush_count == 1


@pytest.mark.asyncio
async def test_admin_reset_password_forces_change_and_blocks_self(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    performer = SimpleNamespace(
        id=uuid.uuid4(),
        email="admin@example.com",
        role=AdminRole.ADMIN,
    )
    target = SimpleNamespace(
        id=uuid.uuid4(),
        email="reset@example.com",
        hashed_password=hash_password("ValidPass1!"),
        name="Reset User",
        role=AdminRole.MANAGER,
        is_active=True,
        failed_login_attempts=4,
        locked_until=datetime.now(timezone.utc),
        is_first_login=False,
        must_change_password=False,
    )

    async def fake_get_by_id(_db, user_id):
        assert user_id == target.id
        return target

    monkeypatch.setattr(auth_service.admin_repo, "get_by_id", fake_get_by_id)

    updated = await auth_service.admin_reset_password(db, target.id, "NewPass1!", performer)

    assert updated is target
    assert target.must_change_password is True
    assert target.is_first_login is False
    assert target.failed_login_attempts == 0
    assert target.locked_until is None
    assert db.flush_count == 1

    with pytest.raises(HTTPException) as exc:
        await auth_service.admin_reset_password(db, performer.id, "NewPass1!", performer)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_permission_rejects_missing_permission(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_user_permissions(*args, **kwargs):
        return {"appointments.view"}

    monkeypatch.setattr("app.core.deps.get_user_permissions", fake_get_user_permissions)

    guard = require_permission("services.manage")

    with pytest.raises(HTTPException) as exc:
        await guard(
            current_user=SimpleNamespace(
                id=uuid.uuid4(),
                role=AdminRole.MANAGER,
                template_id=None,
                _token_payload={},
            ),
            db=FakeDB(),
            redis=FakeRedis(),
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_requires_full_admin_compatibility_bundle(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_user_permissions(*args, **kwargs):
        return {"services.manage"}

    monkeypatch.setattr("app.core.deps.get_user_permissions", fake_get_user_permissions)

    with pytest.raises(HTTPException) as exc:
        await require_admin(
            current_user=SimpleNamespace(
                id=uuid.uuid4(),
                role=AdminRole.ADMIN,
                template_id=None,
                _token_payload={},
            ),
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_manager_or_above_accepts_complete_manager_bundle(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_user_permissions(*args, **kwargs):
        return set(permissions_module.MANAGER_COMPATIBILITY_PERMISSIONS) | {"appointments.view", "customers.view"}

    monkeypatch.setattr("app.core.deps.get_user_permissions", fake_get_user_permissions)

    result = await require_manager_or_above(
        current_user=SimpleNamespace(
            id=uuid.uuid4(),
            role=AdminRole.MANAGER,
            template_id=None,
            _token_payload={},
        ),
    )

    assert result.role == AdminRole.MANAGER


def test_appointment_status_history_schema_exposes_actor_identity() -> None:
    actor = SimpleNamespace(name="Phanindra Durga", email="phanindra@example.com")
    record = SimpleNamespace(
        id=uuid.uuid4(),
        appointment_id=uuid.uuid4(),
        old_status="confirmed",
        new_status="cancelled",
        changed_by_id=uuid.uuid4(),
        changed_by=actor,
        reason="Customer unavailable",
        source=None,
        reschedule_source=None,
        slot_start_time=None,
        old_slot_start_time=None,
        created_at=datetime.now(timezone.utc),
    )

    payload = AppointmentStatusHistoryRead.from_orm_with_user(record)

    assert payload.changed_by_name == "Phanindra Durga"
    assert payload.changed_by_email == "phanindra@example.com"


def test_entity_change_history_schema_exposes_actor_email() -> None:
    actor = SimpleNamespace(name="Phanindra Durga", email="phanindra@example.com")
    record = SimpleNamespace(
        id=uuid.uuid4(),
        entity_type="customer",
        entity_id=str(uuid.uuid4()),
        field_name="email",
        old_value="old@example.com",
        new_value="new@example.com",
        changed_by_id=uuid.uuid4(),
        changed_by=actor,
        created_at=datetime.now(timezone.utc),
    )

    payload = EntityChangeHistoryRead.from_orm_with_user(record)

    assert payload.changed_by_name == "Phanindra Durga"
    assert payload.changed_by_email == "phanindra@example.com"


def test_customer_activity_uses_serialized_history_actor_fields() -> None:
    source = inspect.getsource(customers_api.get_customer_activity)

    assert "EntityChangeHistoryRead.from_orm_with_user(h)" in source
    assert '"changed_by_name": history_entry.changed_by_name' in source
    assert '"changed_by_email": history_entry.changed_by_email' in source


def test_customer_appointments_repository_eager_loads_customer_relation() -> None:
    source = inspect.getsource(customer_repository.get_customer_appointments)

    assert "selectinload(Appointment.customer)" in source
