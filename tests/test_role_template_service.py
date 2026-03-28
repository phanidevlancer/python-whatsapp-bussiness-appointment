from __future__ import annotations

from types import SimpleNamespace
import uuid

import pytest
from fastapi import HTTPException

from app.models.admin_user import AdminRole
from app.schemas.role_template import RoleTemplateCopyRequest, RoleTemplateCreate, RoleTemplatePermissionsUpdate, RoleTemplateUpdate
from app.services import role_template_service as svc


class FakeDB:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.deleted: list[object] = []
        self.flush_count = 0

    def add(self, obj) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flush_count += 1
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()

    async def delete(self, obj) -> None:
        self.deleted.append(obj)


def _make_user() -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), name="Admin", email="admin@example.com")


def _make_template(name: str, *, is_system: bool = False, template_id: uuid.UUID | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=template_id or uuid.uuid4(),
        name=name,
        description=None,
        is_system=is_system,
        is_active=True,
        copied_from_template_id=None,
        created_by=None,
        updated_by=None,
        permissions=[],
    )


@pytest.mark.asyncio
async def test_create_template_sets_permissions_and_creator(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    creator = _make_user()
    permission_a = SimpleNamespace(id=uuid.uuid4(), code="appointments.view")
    permission_b = SimpleNamespace(id=uuid.uuid4(), code="customers.view")
    created_template = SimpleNamespace(
        id=None,
        name="Nurse",
        description="Nurse template",
        is_system=False,
        is_active=True,
        copied_from_template_id=None,
        created_by=None,
        updated_by=None,
        permissions=[],
    )

    async def get_by_name(_db, name):
        return None

    async def get_by_ids(_db, ids):
        assert ids == [permission_a.id, permission_b.id]
        return [permission_a, permission_b]

    async def set_template_permissions(_db, template_id, permissions):
        assert template_id == created_template.id
        created_template.permissions = list(permissions)
        return created_template

    def fake_role_template(**kwargs):
        created_template.name = kwargs["name"]
        created_template.description = kwargs["description"]
        created_template.is_system = kwargs["is_system"]
        created_template.is_active = kwargs["is_active"]
        created_template.copied_from_template_id = kwargs.get("copied_from_template_id")
        created_template.created_by = kwargs["created_by"]
        created_template.updated_by = kwargs["updated_by"]
        return created_template

    monkeypatch.setattr(svc.template_repo, "get_by_name", get_by_name)
    monkeypatch.setattr(svc.perm_repo, "get_by_ids", get_by_ids)
    monkeypatch.setattr(svc.template_repo, "set_template_permissions", set_template_permissions)
    monkeypatch.setattr(svc, "RoleTemplate", fake_role_template)

    payload = RoleTemplateCreate(name="Nurse", description="Nurse template", permission_ids=[permission_a.id, permission_b.id])
    created = await svc.create_template(db, payload, creator)

    assert created is created_template
    assert created.id is not None
    assert created.created_by == creator.id
    assert created.updated_by == creator.id
    assert [perm.code for perm in created.permissions] == ["appointments.view", "customers.view"]
    assert db.flush_count >= 1


@pytest.mark.asyncio
async def test_system_template_update_is_blocked(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    template = _make_template("Admin", is_system=True)

    async def fake_get_by_id(_db, template_id):
        return template

    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id)

    with pytest.raises(HTTPException) as exc:
        await svc.update_template(db, template.id, RoleTemplateUpdate(name="Admin v2"), _make_user())

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_delete_template_blocks_assigned_templates(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    template = _make_template("Reception")

    async def fake_get_by_id(_db, template_id):
        return template

    async def fake_count(_db, template_id):
        return 3

    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(svc.template_repo, "count_users_assigned", fake_count)

    with pytest.raises(HTTPException) as exc:
        await svc.delete_template(db, template.id)

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_replace_permissions_blocks_system_templates(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    template = _make_template("Viewer", is_system=True)

    async def fake_get_by_id(_db, template_id):
        return template

    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id)

    with pytest.raises(HTTPException) as exc:
        await svc.replace_permissions(db, template.id, RoleTemplatePermissionsUpdate(permission_ids=[]), _make_user())

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_copy_template_rejects_duplicate_name(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    source = _make_template("Source")
    duplicate = _make_template("Duplicate")

    async def fake_get_by_id(_db, template_id):
        return source

    async def fake_get_by_name(_db, name):
        return duplicate if name == "Duplicate" else None

    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(svc.template_repo, "get_by_name", fake_get_by_name)

    with pytest.raises(HTTPException) as exc:
        await svc.copy_template(db, source.id, "Duplicate", _make_user())

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_get_usage_returns_users(monkeypatch: pytest.MonkeyPatch) -> None:
    db = FakeDB()
    template = _make_template("Custom")
    users = [
        SimpleNamespace(id=uuid.uuid4(), name="A", email="a@example.com", is_active=True),
        SimpleNamespace(id=uuid.uuid4(), name="B", email="b@example.com", is_active=False),
    ]

    async def fake_get_by_id(_db, template_id):
        return template

    async def fake_list_users(_db, template_id):
        return users

    monkeypatch.setattr(svc.template_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(svc.template_repo, "list_users_assigned", fake_list_users)

    usage = await svc.get_usage(db, template.id)

    assert usage["user_count"] == 2
    assert usage["users"] == users
