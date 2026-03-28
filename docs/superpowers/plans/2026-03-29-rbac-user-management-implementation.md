# RBAC + User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a template-based RBAC system with reusable backend permission enforcement, first-login password reset, user/template management APIs, and matching frontend permission guards for the CRM.

**Architecture:** Replace the current hardcoded `AdminUser.role` authorization flow with `role_templates + permissions + role_template_permissions`, keeping the legacy `role` field only for migration/backfill. Authorization will be centralized through reusable backend permission helpers and a frontend permission store/hook so route handlers and pages stay thin.

**Tech Stack:** FastAPI, PostgreSQL, SQLAlchemy, Alembic, Pydantic, Redis, JWT, passlib/bcrypt, Next.js, TypeScript, Tailwind CSS, TanStack Query, Zustand

---

## File Map

### Backend

- Create: `app/core/permissions.py`
- Modify: `app/core/security.py`
- Modify: `app/core/deps.py`
- Modify: `app/models/admin_user.py`
- Create: `app/models/permission.py`
- Create: `app/models/role_template.py`
- Create: `app/models/user_audit_log.py`
- Modify: `app/models/__init__.py`
- Modify: `app/schemas/admin_user.py`
- Create: `app/schemas/permission.py`
- Create: `app/schemas/role_template.py`
- Create: `app/schemas/user_management.py`
- Modify: `app/repositories/admin_user_repository.py`
- Create: `app/repositories/permission_repository.py`
- Create: `app/repositories/role_template_repository.py`
- Modify: `app/services/auth_service.py`
- Create: `app/services/user_management_service.py`
- Create: `app/services/role_template_service.py`
- Modify: `app/api/v1/auth.py`
- Create: `app/api/v1/users.py`
- Create: `app/api/v1/role_templates.py`
- Create: `app/api/v1/permissions.py`
- Modify: `app/api/v1/customers.py`
- Modify: `main.py`
- Create: `app/db/seed.py`
- Create: `alembic/versions/<revision>_add_rbac_and_user_management.py`

### Frontend

- Modify: `crm-frontend/src/types/auth.ts`
- Modify: `crm-frontend/src/store/authStore.ts`
- Modify: `crm-frontend/src/lib/api.ts`
- Create: `crm-frontend/src/lib/permissions.ts`
- Modify: `crm-frontend/src/hooks/useAuth.ts`
- Create: `crm-frontend/src/hooks/usePermission.ts`
- Create: `crm-frontend/src/hooks/useUsers.ts`
- Create: `crm-frontend/src/hooks/useRoleTemplates.ts`
- Create: `crm-frontend/src/components/auth/PermissionGuard.tsx`
- Create: `crm-frontend/src/components/role-templates/PermissionMatrix.tsx`
- Modify: `crm-frontend/src/components/layout/Sidebar.tsx`
- Modify: `crm-frontend/src/app/(dashboard)/layout.tsx`
- Create: `crm-frontend/src/app/(auth)/change-password/page.tsx`
- Create: `crm-frontend/src/app/(dashboard)/users/page.tsx`
- Create: `crm-frontend/src/app/(dashboard)/users/[id]/page.tsx`
- Create: `crm-frontend/src/app/(dashboard)/role-templates/page.tsx`
- Create: `crm-frontend/src/app/(dashboard)/role-templates/[id]/page.tsx`

### Tests

- Create: `tests/test_auth_rbac.py`
- Create: `tests/test_role_template_service.py`
- Create: `tests/test_user_management_service.py`

---

### Task 1: Add RBAC Models and Migration

**Files:**
- Modify: `app/models/admin_user.py`
- Create: `app/models/permission.py`
- Create: `app/models/role_template.py`
- Create: `app/models/user_audit_log.py`
- Modify: `app/models/__init__.py`
- Create: `alembic/versions/<revision>_add_rbac_and_user_management.py`
- Test: `tests/test_auth_rbac.py`

- [ ] Add SQLAlchemy models for `Permission`, `RoleTemplate`, `RoleTemplatePermission`, and `UserAuditLog`.
- [ ] Extend `AdminUser` with `template_id`, `employee_code`, `phone`, `is_first_login`, `must_change_password`, `last_login_at`, `created_by`, `updated_by`, `failed_login_attempts`, and `locked_until`.
- [ ] Keep the current `role` enum column in place for migration compatibility.
- [ ] Write migration tables, indexes, foreign keys, and uniqueness constraints.
- [ ] Add a migration backfill section that creates nullable `template_id` first, then allows seed/backfill before enforcing usage in code.
- [ ] Run: `alembic upgrade head`
- [ ] Run: `pytest tests/test_auth_rbac.py -v`
- [ ] Commit:

```bash
git add app/models app/models/__init__.py alembic/versions tests/test_auth_rbac.py
git commit -m "feat: add rbac schema models and migration"
```

### Task 2: Seed Permissions and System Templates

**Files:**
- Create: `app/db/seed.py`
- Create: `app/repositories/permission_repository.py`
- Create: `app/repositories/role_template_repository.py`
- Test: `tests/test_role_template_service.py`

- [ ] Create a static permission catalog with explicit codes like `appointments.view`, `customers.partial_update_contact`, `roles.manage`.
- [ ] Add idempotent seed functions:
  `seed_permissions(db)` and `seed_system_templates(db)`.
- [ ] Seed system templates: `Super Admin`, `Admin`, `Receptionist`, `Viewer`, `Operations Manager`.
- [ ] Backfill existing `admin_users.role` values to matching system templates inside the seed flow.
- [ ] Expose a CLI-safe entrypoint:

```python
async def run_seed(db: AsyncSession) -> None:
    await seed_permissions(db)
    await seed_system_templates(db)
```

- [ ] Run: `python -m app.db.seed`
- [ ] Run: `pytest tests/test_role_template_service.py -v`
- [ ] Commit:

```bash
git add app/db/seed.py app/repositories/permission_repository.py app/repositories/role_template_repository.py tests/test_role_template_service.py
git commit -m "feat: seed permission catalog and system templates"
```

### Task 3: Centralize Permission Resolution and Token Security

**Files:**
- Create: `app/core/permissions.py`
- Modify: `app/core/security.py`
- Modify: `app/core/deps.py`
- Test: `tests/test_auth_rbac.py`

- [ ] Add JWT `jti` generation and decoding support in `app/core/security.py`.
- [ ] Add Redis-backed helpers in `app/core/permissions.py`:
  `build_permissions_hash(user)`, `get_cached_permissions()`, `cache_permissions()`, `blacklist_token()`, `is_token_blacklisted()`, `invalidate_user_permissions_cache()`.
- [ ] Replace hardcoded role dependencies with:

```python
def require_permission(code: str):
    async def dependency(
        current_user = Depends(get_current_admin_user),
        request: Request = None,
    ):
        ...
    return dependency
```

- [ ] Add `get_current_user_permissions()` helper for service-layer reuse.
- [ ] Keep `require_admin` and `require_manager_or_above` temporarily, but reimplement them using permission codes so existing routes do not break during transition.
- [ ] Run: `pytest tests/test_auth_rbac.py -v`
- [ ] Commit:

```bash
git add app/core/security.py app/core/deps.py app/core/permissions.py tests/test_auth_rbac.py
git commit -m "feat: add reusable permission enforcement and token blacklist"
```

### Task 4: Upgrade Auth Service for First Login and Forced Password Change

**Files:**
- Modify: `app/services/auth_service.py`
- Modify: `app/api/v1/auth.py`
- Modify: `app/schemas/admin_user.py`
- Create: `app/schemas/user_management.py`
- Test: `tests/test_auth_rbac.py`

- [ ] Change login response to include `must_change_password`, `user`, and `permissions`.
- [ ] Add lockout handling using `failed_login_attempts` and `locked_until`.
- [ ] Update login success flow to set `last_login_at` and clear failed attempts.
- [ ] Add `change_password()` service flow that:
  hashes the password, clears `is_first_login`, clears `must_change_password`, blacklists current token, and issues a fresh token.
- [ ] Add `admin_reset_password()` that marks the target user for forced reset and blocks self-reset through the admin endpoint.
- [ ] Use password policy validation in schemas.
- [ ] Run: `pytest tests/test_auth_rbac.py -v`
- [ ] Commit:

```bash
git add app/services/auth_service.py app/api/v1/auth.py app/schemas/admin_user.py app/schemas/user_management.py tests/test_auth_rbac.py
git commit -m "feat: add first login reset and hardened auth flow"
```

### Task 5: Build Role Template Service and API

**Files:**
- Create: `app/schemas/permission.py`
- Create: `app/schemas/role_template.py`
- Create: `app/services/role_template_service.py`
- Create: `app/api/v1/role_templates.py`
- Create: `app/api/v1/permissions.py`
- Modify: `main.py`
- Test: `tests/test_role_template_service.py`

- [ ] Implement template CRUD with usage count checks and copy support.
- [ ] Enforce system-template protections in the service layer:
  block edit, delete, and permission replacement for `is_system=True`.
- [ ] Add confirm-friendly usage response that returns assigned user count.
- [ ] Add grouped permissions listing endpoint for the frontend permission matrix.
- [ ] Register new routers in `main.py`.
- [ ] Run: `pytest tests/test_role_template_service.py -v`
- [ ] Commit:

```bash
git add app/schemas/permission.py app/schemas/role_template.py app/services/role_template_service.py app/api/v1/role_templates.py app/api/v1/permissions.py main.py tests/test_role_template_service.py
git commit -m "feat: add role template and permission management api"
```

### Task 6: Build User Management Service and API

**Files:**
- Modify: `app/repositories/admin_user_repository.py`
- Create: `app/services/user_management_service.py`
- Create: `app/api/v1/users.py`
- Create: `app/models/user_audit_log.py`
- Test: `tests/test_user_management_service.py`

- [ ] Add repository methods for:
  paginated listing, detail with template, update, deactivate, activate, assign template, and audit retrieval.
- [ ] Add service-layer rules:
  block self-deactivation, block self-escalation, block non-managers from creating users/templates, invalidate target permission cache after template changes.
- [ ] Implement create-user flow with admin-provided temporary password and `must_change_password=True`.
- [ ] Add user audit entries for create, update, template change, deactivate, activate, and admin password reset.
- [ ] Run: `pytest tests/test_user_management_service.py -v`
- [ ] Commit:

```bash
git add app/repositories/admin_user_repository.py app/services/user_management_service.py app/api/v1/users.py app/models/user_audit_log.py tests/test_user_management_service.py
git commit -m "feat: add user management api and audit logging"
```

### Task 7: Protect Existing Backend Routes with Permissions

**Files:**
- Modify: `app/api/v1/customers.py`
- Modify: `app/api/v1/services.py`
- Modify: `app/api/v1/providers.py`
- Modify: `app/api/v1/dashboard.py`
- Modify: `app/api/v1/appointments.py`
- Modify: `app/api/v1/leads.py`
- Modify: `app/api/v1/notifications.py`

- [ ] Replace broad role checks with explicit permission dependencies.
- [ ] Add `PATCH /api/v1/customers/{id}/contact` with a restricted schema and `customers.partial_update_contact`.
- [ ] Keep route handlers thin by delegating non-trivial logic to services or existing repositories.
- [ ] Run: `pytest tests/test_auth_rbac.py tests/test_user_management_service.py -v`
- [ ] Commit:

```bash
git add app/api/v1/customers.py app/api/v1/services.py app/api/v1/providers.py app/api/v1/dashboard.py app/api/v1/appointments.py app/api/v1/leads.py app/api/v1/notifications.py
git commit -m "refactor: protect crm endpoints with permission dependencies"
```

### Task 8: Extend Frontend Auth State for Permissions

**Files:**
- Modify: `crm-frontend/src/types/auth.ts`
- Modify: `crm-frontend/src/store/authStore.ts`
- Modify: `crm-frontend/src/hooks/useAuth.ts`
- Modify: `crm-frontend/src/lib/api.ts`

- [ ] Extend auth types to include `permissions`, `template_id`, and `must_change_password`.
- [ ] Update Zustand store with:

```ts
permissions: string[]
mustChangePassword: boolean
hasPermission: (code: string) => boolean
```

- [ ] Update login flow to persist permissions and redirect to `/change-password` when required.
- [ ] Update API interceptor to clear auth state on `401`.
- [ ] Run: `npm exec eslint src/types/auth.ts src/store/authStore.ts src/hooks/useAuth.ts src/lib/api.ts`
- [ ] Commit:

```bash
git add crm-frontend/src/types/auth.ts crm-frontend/src/store/authStore.ts crm-frontend/src/hooks/useAuth.ts crm-frontend/src/lib/api.ts
git commit -m "feat: add frontend auth permission state"
```

### Task 9: Add Frontend Permission Utilities and Route Guards

**Files:**
- Create: `crm-frontend/src/lib/permissions.ts`
- Create: `crm-frontend/src/hooks/usePermission.ts`
- Create: `crm-frontend/src/components/auth/PermissionGuard.tsx`
- Modify: `crm-frontend/src/app/(dashboard)/layout.tsx`
- Modify: `crm-frontend/src/components/layout/Sidebar.tsx`

- [ ] Mirror backend permission codes in a single frontend constants file.
- [ ] Add `usePermission(code)` and `usePermissions(map)` helpers.
- [ ] Add `PermissionGuard` for button/table/action visibility.
- [ ] Update dashboard layout to hard-redirect to `/change-password` until reset is complete.
- [ ] Filter sidebar navigation by permission codes instead of unconditional rendering.
- [ ] Run: `npm exec eslint src/lib/permissions.ts src/hooks/usePermission.ts src/components/auth/PermissionGuard.tsx src/app/(dashboard)/layout.tsx src/components/layout/Sidebar.tsx`
- [ ] Commit:

```bash
git add crm-frontend/src/lib/permissions.ts crm-frontend/src/hooks/usePermission.ts crm-frontend/src/components/auth/PermissionGuard.tsx crm-frontend/src/app/'(dashboard)'/layout.tsx crm-frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add frontend permission hooks and route guards"
```

### Task 10: Add Change Password Page and User Management UI

**Files:**
- Create: `crm-frontend/src/hooks/useUsers.ts`
- Create: `crm-frontend/src/app/(auth)/change-password/page.tsx`
- Create: `crm-frontend/src/app/(dashboard)/users/page.tsx`
- Create: `crm-frontend/src/app/(dashboard)/users/[id]/page.tsx`

- [ ] Add `useUsers` hooks for list/detail/create/update/template assignment/reset/deactivate.
- [ ] Build `/change-password` as a dedicated blocking page.
- [ ] Build users list with create/edit/deactivate actions and permission-based button visibility.
- [ ] Build user detail page with audit trail and template assignment controls.
- [ ] Run: `npm exec eslint src/hooks/useUsers.ts src/app/'(auth)'/change-password/page.tsx src/app/'(dashboard)'/users/page.tsx src/app/'(dashboard)'/users/'[id]'/page.tsx`
- [ ] Commit:

```bash
git add crm-frontend/src/hooks/useUsers.ts crm-frontend/src/app/'(auth)'/change-password/page.tsx crm-frontend/src/app/'(dashboard)'/users/page.tsx crm-frontend/src/app/'(dashboard)'/users/'[id]'/page.tsx
git commit -m "feat: add change password and user management ui"
```

### Task 11: Add Role Template UI and Permission Matrix

**Files:**
- Create: `crm-frontend/src/hooks/useRoleTemplates.ts`
- Create: `crm-frontend/src/components/role-templates/PermissionMatrix.tsx`
- Create: `crm-frontend/src/app/(dashboard)/role-templates/page.tsx`
- Create: `crm-frontend/src/app/(dashboard)/role-templates/[id]/page.tsx`

- [ ] Add role-template query and mutation hooks.
- [ ] Build a reusable permission matrix grouped by module and action.
- [ ] Render system templates read-only.
- [ ] Add copy-template flow and usage-warning flow before destructive edits/deletes.
- [ ] Run: `npm exec eslint src/hooks/useRoleTemplates.ts src/components/role-templates/PermissionMatrix.tsx src/app/'(dashboard)'/role-templates/page.tsx src/app/'(dashboard)'/role-templates/'[id]'/page.tsx`
- [ ] Commit:

```bash
git add crm-frontend/src/hooks/useRoleTemplates.ts crm-frontend/src/components/role-templates/PermissionMatrix.tsx crm-frontend/src/app/'(dashboard)'/role-templates/page.tsx crm-frontend/src/app/'(dashboard)'/role-templates/'[id]'/page.tsx
git commit -m "feat: add role template management ui"
```

### Task 12: Final Integration, Seed Wiring, and Regression Pass

**Files:**
- Modify: `main.py`
- Modify: `seed.py`
- Modify: `README.md`
- Modify: `SETUP.md`
- Test: `tests/test_auth_rbac.py`
- Test: `tests/test_role_template_service.py`
- Test: `tests/test_user_management_service.py`

- [ ] Wire seed execution so developers can bootstrap permissions/templates reliably.
- [ ] Document migration order, seed command, first-login flow, and default system templates.
- [ ] Run backend checks:

```bash
pytest tests/test_auth_rbac.py tests/test_role_template_service.py tests/test_user_management_service.py -v
```

- [ ] Run frontend checks:

```bash
cd crm-frontend
npm exec eslint src
```

- [ ] Run migration locally on a fresh database and verify seeded templates exist.
- [ ] Commit:

```bash
git add main.py seed.py README.md SETUP.md tests
git commit -m "docs: wire rbac setup and verify integration flow"
```

---

## Self-Review

- Spec coverage: backend RBAC, user/template CRUD, permissions, seed strategy, first-login password change, route guards, customer partial update, and security controls are all covered by Tasks 1-12.
- Placeholder scan: no `TODO`, `TBD`, or “handle appropriately” style steps remain.
- Consistency: permission terminology uses `role_templates`, `permissions`, `require_permission`, `must_change_password`, and `customers.partial_update_contact` throughout.

---

## Notes for Implementation

- Do not delete the legacy `AdminUser.role` field in the first migration. Stop using it in authorization first, then remove it in a later cleanup migration after production data is stable.
- Keep route handlers thin. Permission rules belong in `app/core/deps.py` and service-layer assertions, not duplicated inline in routers.
- Frontend guards are UX-only. Every protected operation must still be enforced by backend permission checks.
- Use frequent small commits. Do not bundle backend model work, auth changes, and frontend pages into one commit.

