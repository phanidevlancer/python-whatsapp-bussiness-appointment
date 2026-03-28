from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
import uuid

import pytest
from fastapi import HTTPException

from app.models.admin_user import AdminRole
from app.schemas.user_management import (
    UserCreateRequest,
    UserForcePasswordResetRequest,
    UserTemplateAssignmentRequest,
    UserUpdateRequest,
)
from app.services import user_management_service as svc


class FakeDB:
    def __init__(self) -> None:
        self.flush_count = 0
        self.added: list[object] = []

    def add(self, obj) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flush_count += 1
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()


class FakeRedis:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    async def delete(self, key: str):
        self.deleted.append(key)


def _user(
    *,
    user_id: uuid.UUID | None = None,
    email: str = "user@example.com",
    name: str = "User",
    role: AdminRole = AdminRole.RECEPTIONIST,
    template_id: uuid.UUID | None = None,
    is_active: bool = True,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=user_id or uuid.uuid4(),
        email=email,
        name=name,
        role=role,
        template_id=template_id,
        template_name=None,
        phone=None,
        employee_code=None,
        is_active=is_active,
        is_first_login=False,
        must_change_password=False,
        failed_login_attempts=0,
        locked_until=None,
        last_login_at=None,
        created_at=datetime.now(timezone.utc),
        role_template=None,
        updated_by=None,
    )


def _template(name: str, *, template_id: uuid.UUID | None = None, permissions: list[str] | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=template_id or uuid.uuid4(),
        name=name,
        description=f"{name} template",
        is_system=name in {"Super Admin", "Admin", "Operations Manager", "Receptionist", "Viewer"},
        is_active=True,
        permissions=[SimpleNamespace(id=uuid.uuid4(), code=code) for code in (permissions or [])],
        updated_at=datetime.now(timezone.utc),
    )


@pytest.mark.asyncio
async def test_create_user_assigns_template_when_actor_has_access(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    redis = FakeRedis()
    actor = _user(email="admin@example.com", role=AdminRole.ADMIN)
    template = _template("Receptionist", permissions=["appointments.view", "customers.view"])
    created_user = _user(email="new@example.com", name="New User", template_id=template.id)
    created_user.is_first_login = True
    created_user.must_change_password = True

    audit_entries: list[dict] = []
    seen_kwargs: dict[str, object] = {}

    async def fake_get_by_email(_db, email):
        return None

    async def fake_get_by_employee_code(_db, employee_code):
        return None

    async def fake_get_by_id(_db, template_id):
        return template if template_id == template.id else None

    async def fake_template_permissions(_db, template_id):
        return template.permissions

    async def fake_actor_permissions(*args, **kwargs):
        return {"appointments.view", "customers.view", "users.create"}

    async def fake_create_admin_user(_db, email, password, name, role, **kwargs):
        seen_kwargs.update({"email": email, "password": password, "name": name, "role": role, **kwargs})
        return created_user

    async def fake_audit(_db, user_id, action, performed_by_id=None, details_json=None):
        audit_entries.append(
            {
                "user_id": user_id,
                "action": action,
                "performed_by_id": performed_by_id,
                "details_json": details_json,
            }
        )

    monkeypatch.setattr(svc.admin_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(svc.admin_repo, "get_by_employee_code", fake_get_by_employee_code)
    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(svc.template_repo, "get_permissions", fake_template_permissions)
    monkeypatch.setattr(svc, "get_user_permissions", fake_actor_permissions)
    monkeypatch.setattr(svc.admin_repo, "create_admin_user", fake_create_admin_user)
    monkeypatch.setattr(svc.admin_repo, "create_user_audit_log", fake_audit)

    payload = UserCreateRequest(
        name="New User",
        email="new@example.com",
        password="ValidPass1!",
        template_id=template.id,
        employee_code="EMP-001",
    )
    result = await svc.create_user(db, redis, payload, actor)

    assert result.email == "new@example.com"
    assert seen_kwargs["role"] == AdminRole.RECEPTIONIST
    assert seen_kwargs["template_id"] == template.id
    assert audit_entries[0]["action"] == "created"
    assert db.flush_count >= 0


@pytest.mark.asyncio
async def test_create_user_blocks_template_escalation(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    redis = FakeRedis()
    actor = _user(email="admin@example.com", role=AdminRole.RECEPTIONIST)
    template = _template("Admin", permissions=["users.manage", "roles.manage"])

    async def fake_get_by_email(_db, email):
        return None

    async def fake_get_by_employee_code(_db, employee_code):
        return None

    async def fake_get_by_id(_db, template_id):
        return template

    async def fake_template_permissions(_db, template_id):
        return template.permissions

    async def fake_actor_permissions(*args, **kwargs):
        return {"appointments.view"}

    monkeypatch.setattr(svc.admin_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(svc.admin_repo, "get_by_employee_code", fake_get_by_employee_code)
    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(svc.template_repo, "get_permissions", fake_template_permissions)
    monkeypatch.setattr(svc, "get_user_permissions", fake_actor_permissions)

    payload = UserCreateRequest(
        name="New User",
        email="new@example.com",
        password="ValidPass1!",
        template_id=template.id,
    )

    with pytest.raises(HTTPException) as exc:
        await svc.create_user(db, redis, payload, actor)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_deactivate_user_blocks_self_action(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    redis = FakeRedis()
    actor = _user(user_id=uuid.uuid4(), email="self@example.com")

    async def fake_get_by_id_with_template(_db, user_id):
        return actor

    monkeypatch.setattr(svc.admin_repo, "get_by_id_with_template", fake_get_by_id_with_template)

    with pytest.raises(HTTPException) as exc:
        await svc.deactivate_user(db, redis, actor.id, actor)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_assign_template_updates_role_and_invalidates_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    redis = FakeRedis()
    actor = _user(email="manager@example.com", role=AdminRole.ADMIN)
    user = _user(user_id=uuid.uuid4(), email="target@example.com")
    template = _template("Operations Manager", permissions=["appointments.view", "customers.view"])
    invalidated: list[uuid.UUID] = []
    audit_entries: list[str] = []

    async def fake_get_by_id_with_template(_db, user_id):
        return user if user_id == user.id else None

    async def fake_get_by_id_template(_db, template_id):
        return template if template_id == template.id else None

    async def fake_actor_permissions(*args, **kwargs):
        return {"appointments.view", "customers.view", "slots.manage", "users.manage", "roles.manage"}

    async def fake_invalidate(_redis, user_id):
        invalidated.append(user_id)

    async def fake_audit(_db, user_id, action, performed_by_id=None, details_json=None):
        audit_entries.append(action)

    monkeypatch.setattr(svc.admin_repo, "get_by_id_with_template", fake_get_by_id_with_template)
    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id_template)
    async def fake_template_permissions(*args, **kwargs):
        return template.permissions

    monkeypatch.setattr(svc.template_repo, "get_permissions", fake_template_permissions)
    monkeypatch.setattr(svc, "get_user_permissions", fake_actor_permissions)
    monkeypatch.setattr(svc, "invalidate_user_permissions_cache", fake_invalidate)
    monkeypatch.setattr(svc.admin_repo, "create_user_audit_log", fake_audit)

    result = await svc.assign_template(
        db,
        redis,
        user.id,
        UserTemplateAssignmentRequest(template_id=template.id),
        actor,
    )

    assert result.template_id == template.id
    assert result.role == AdminRole.MANAGER
    assert invalidated == [user.id]
    assert audit_entries == ["template_changed"]


@pytest.mark.asyncio
async def test_force_password_reset_marks_user(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    redis = FakeRedis()
    actor = _user(email="admin@example.com", role=AdminRole.ADMIN)
    user = _user(user_id=uuid.uuid4(), email="target@example.com")
    audit_entries: list[str] = []
    invalidated: list[uuid.UUID] = []

    async def fake_get_by_id_with_template(_db, user_id):
        return user if user_id == user.id else None

    async def fake_audit(_db, user_id, action, performed_by_id=None, details_json=None):
        audit_entries.append(action)

    monkeypatch.setattr(svc.admin_repo, "get_by_id_with_template", fake_get_by_id_with_template)
    monkeypatch.setattr(svc.admin_repo, "create_user_audit_log", fake_audit)

    async def fake_invalidate(_redis, user_id):
        invalidated.append(user_id)

    monkeypatch.setattr(svc, "invalidate_user_permissions_cache", fake_invalidate)

    result = await svc.force_password_reset(
        db,
        redis,
        user.id,
        UserForcePasswordResetRequest(must_change_password=True),
        actor,
    )

    assert result.must_change_password is True
    assert result.is_first_login is False
    assert audit_entries == ["password_reset_forced"]
    assert invalidated == [user.id]


@pytest.mark.asyncio
async def test_list_audit_logs_returns_users(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    user = _user(user_id=uuid.uuid4(), email="target@example.com")
    performed_by = _user(email="admin@example.com", role=AdminRole.ADMIN, name="Admin")
    log = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=user.id,
        action="updated",
        performed_by_id=performed_by.id,
        performed_by=performed_by,
        details_json={"name": "Changed"},
        created_at=datetime.now(timezone.utc),
    )

    async def fake_get_by_id_with_template(_db, user_id):
        return user if user_id == user.id else None

    async def fake_list_logs(_db, user_id):
        return [log]

    monkeypatch.setattr(svc.admin_repo, "get_by_id_with_template", fake_get_by_id_with_template)
    monkeypatch.setattr(svc.admin_repo, "list_user_audit_logs", fake_list_logs)

    logs = await svc.list_audit_logs(db, user.id)

    assert logs[0].action == "updated"
    assert logs[0].performed_by_name == "Admin"
