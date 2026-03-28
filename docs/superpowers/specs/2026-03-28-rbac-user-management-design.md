# RBAC + User Management System Design

**Date:** 2026-03-28
**Project:** WhatsApp Appointment Booking CRM
**Status:** Approved

---

## Overview

Add a complete user management + authorization system to the existing CRM admin tool. Replace the current hardcoded `role` string on `AdminUser` with a flexible, template-based RBAC system supporting predefined system roles, custom role templates, first-login password reset, and per-module/action permission enforcement.

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Token + permissions strategy | Hybrid: JWT with JTI + permission hash, Redis cache for permissions, hard invalidation on deactivate/template change |
| Partial customer update | Dedicated endpoint `PATCH /customers/{id}/contact` with `customers.partial_update_contact` permission |
| Session revocation | Immediate — JTI blacklisted in Redis on deactivate/password reset/template change |
| Custom template mutation | Warn + confirm (show affected user count), then apply immediately to all assigned users |
| First-login password change | Separate `/change-password` page, hard redirect guard, no app access until complete |
| User creation password | Admin sets temporary password during user creation |
| RBAC approach | Option A: Flat permission codes + RoleTemplate table |

---

## Data Model

### New Tables

#### `permissions`
```
id            UUID PK
module        VARCHAR (e.g. "appointments")
action        VARCHAR (e.g. "create")
code          VARCHAR UNIQUE (e.g. "appointments.create")
description   TEXT
```
Seeded once. Never user-editable.

#### `role_templates`
```
id                       UUID PK
name                     VARCHAR UNIQUE
description              TEXT
is_system                BOOLEAN DEFAULT false
is_active                BOOLEAN DEFAULT true
copied_from_template_id  UUID FK self (nullable)
created_by               UUID FK admin_users (nullable)
updated_by               UUID FK admin_users (nullable)
created_at               TIMESTAMP
updated_at               TIMESTAMP
```

#### `role_template_permissions`
```
id             UUID PK
template_id    UUID FK role_templates
permission_id  UUID FK permissions
UNIQUE(template_id, permission_id)
```

#### `user_audit_log`
```
id              UUID PK
user_id         UUID FK admin_users
action          VARCHAR (e.g. "created", "deactivated", "template_changed", "password_reset")
performed_by_id UUID FK admin_users (nullable)
details_json    JSONB
created_at      TIMESTAMP
```

### Modified Table: `admin_users`

Add columns:
```
template_id              UUID FK role_templates (nullable)
employee_code            VARCHAR UNIQUE (nullable)
phone                    VARCHAR (nullable)
is_first_login           BOOLEAN DEFAULT true
must_change_password     BOOLEAN DEFAULT true
last_login_at            TIMESTAMP (nullable)
created_by               UUID FK admin_users (nullable)
updated_by               UUID FK admin_users (nullable)
failed_login_attempts    INTEGER DEFAULT 0
locked_until             TIMESTAMP (nullable)
```

Keep existing `role` string column during migration. Deprecate after seed assigns templates to existing users.

### Redis Keys (no DB table)

```
token_blacklist:{jti}       → "1"           TTL = remaining token lifetime
user_perms:{user_id}        → JSON list     TTL = 4 hours
user_perms_hash:{user_id}   → short hash    TTL = 4 hours
```

---

## JWT Token Payload

```json
{
  "sub": "user-uuid",
  "jti": "unique-token-id",
  "perms_hash": "abc123",
  "exp": 1234567890
}
```

`perms_hash` = short hash of `template_id:updated_at`. On each request: if hash in token ≠ hash in Redis → re-fetch permissions from DB and update cache.

---

## Permission Universe (~52 permissions)

| Module        | Actions |
|---------------|---------|
| dashboard     | view |
| appointments  | view, create, update, delete, reschedule, cancel, export |
| customers     | view, create, update, delete, export, partial_update_contact |
| services      | view, create, update, delete, manage |
| providers     | view, create, update, delete, manage |
| slots         | view, create, update, delete, manage |
| leads         | view, update, assign, export |
| notifications | view, manage |
| users         | view, create, update, delete, manage |
| roles         | view, create, update, delete, manage |
| reports       | view, export |
| settings      | view, manage |

---

## Predefined System Templates (is_system=true)

### Super Admin
All 52 permissions.

### Admin
All except: `users.delete`, `roles.delete`, `settings.manage`

### Receptionist
```
dashboard.view
appointments.view, create, update, reschedule, cancel
customers.view, partial_update_contact
slots.view
notifications.view
```

### Viewer / Analyst
```
dashboard.view
appointments.view, export
customers.view, export
services.view
providers.view
reports.view, export
leads.view
```

### Operations Manager
```
dashboard.view
appointments.view, create, update, reschedule, cancel, export
customers.view, create, update, export, partial_update_contact
services.view
providers.view, update
slots.view, create, update, manage
leads.view, update, assign, export
notifications.view, manage
reports.view, export
```

---

## Backend Architecture

### New/Modified Files

```
app/
├── core/
│   ├── deps.py              # MODIFIED — require_permission(), get_current_user_permissions()
│   ├── security.py          # MODIFIED — JTI in token, blacklist helpers
│   └── permissions.py       # NEW — permission code constants + Redis cache helpers
├── models/
│   ├── admin_user.py        # MODIFIED — new fields
│   ├── permission.py        # NEW
│   ├── role_template.py     # NEW
│   └── user_audit_log.py    # NEW
├── schemas/
│   ├── admin_user.py        # MODIFIED
│   ├── permission.py        # NEW
│   ├── role_template.py     # NEW
│   └── user_management.py   # NEW
├── repositories/
│   ├── admin_user_repository.py     # MODIFIED
│   ├── permission_repository.py     # NEW
│   └── role_template_repository.py  # NEW
├── services/
│   ├── auth_service.py              # MODIFIED — first login, blacklist, lockout
│   ├── user_management_service.py   # NEW
│   └── role_template_service.py     # NEW
├── api/v1/
│   ├── auth.py                      # MODIFIED — change-password, admin-reset-password
│   ├── users.py                     # NEW
│   └── role_templates.py            # NEW
└── db/
    └── seed.py                      # NEW — permissions + system templates seed
```

### Permission Enforcement

```python
# Single permission — use as FastAPI dependency
@router.post("/appointments")
async def create_appointment(
    _: None = Depends(require_permission("appointments.create")),
    db: AsyncSession = Depends(get_db),
):
    ...

# Partial customer update
@router.patch("/customers/{id}/contact")
async def partial_update_contact(
    _: None = Depends(require_permission("customers.partial_update_contact")),
    ...
):
    ...
```

`require_permission(code)` flow:
1. Validate JWT signature
2. Check Redis token blacklist by JTI → 401 if blacklisted
3. Compare `perms_hash` from token vs Redis hash for user → if mismatch, re-fetch from DB
4. Load permissions from Redis cache
5. Check `code` in permission set → 403 if absent

### Auth Flow: First Login

```
POST /auth/login
  → validate credentials (check lockout first)
  → update last_login_at, reset failed_login_attempts
  → if must_change_password or is_first_login:
      return { access_token, must_change_password: true, permissions: [] }
  → frontend detects flag → hard redirect to /change-password

POST /auth/change-password
  → requires valid token (not blacklisted)
  → validate password policy
  → update hashed_password
  → set is_first_login=false, must_change_password=false
  → blacklist current JTI
  → issue fresh token with full permissions
```

### Service Layer Boundaries

- **`auth_service`** — login, logout, change password, force reset, token blacklist, lockout
- **`user_management_service`** — create/update/deactivate users, assign templates, audit logging, cache invalidation
- **`role_template_service`** — CRUD templates, copy, permission matrix, usage count, system template protection
- **Repositories** — all raw DB queries; services never call `db.execute()` directly

---

## API Contract

### Auth

```
POST   /api/v1/auth/login
GET    /api/v1/auth/me                          # returns permissions[]
POST   /api/v1/auth/logout                      # blacklists JTI
POST   /api/v1/auth/change-password             # first login + self-service
POST   /api/v1/auth/admin-reset-password        # admin resets another user's password
```

### User Management

```
GET    /api/v1/users                            # list (paginated, filterable)
POST   /api/v1/users                            # create user
GET    /api/v1/users/{id}                       # detail
PATCH  /api/v1/users/{id}                       # update basic info
DELETE /api/v1/users/{id}                       # soft delete
PATCH  /api/v1/users/{id}/activate
PATCH  /api/v1/users/{id}/deactivate            # + blacklist token
PATCH  /api/v1/users/{id}/template              # assign/change template
PATCH  /api/v1/users/{id}/force-password-reset
GET    /api/v1/users/{id}/audit-log
```

### Role Templates

```
GET    /api/v1/role-templates
POST   /api/v1/role-templates
GET    /api/v1/role-templates/{id}
PATCH  /api/v1/role-templates/{id}              # warns if users assigned
DELETE /api/v1/role-templates/{id}              # blocked if users assigned or is_system
POST   /api/v1/role-templates/{id}/copy
PATCH  /api/v1/role-templates/{id}/activate
PATCH  /api/v1/role-templates/{id}/deactivate
PATCH  /api/v1/role-templates/{id}/permissions  # replace full permission set
GET    /api/v1/role-templates/{id}/usage        # count + user list
```

### Permissions

```
GET    /api/v1/permissions                      # all permissions grouped by module
```

### Customer Partial Update (addition to existing)

```
PATCH  /api/v1/customers/{id}/contact           # limited fields only
```

### Key Shapes

**Login response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "must_change_password": false,
  "user": { "id": "...", "name": "...", "email": "...", "template_id": "..." },
  "permissions": ["appointments.view", "appointments.create", "customers.view"]
}
```

**Create user request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@clinic.com",
  "phone": "+919876543210",
  "employee_code": "EMP-042",
  "template_id": "uuid",
  "password": "TempPass@123",
  "must_change_password": true
}
```

**Create/update template request:**
```json
{
  "name": "Senior Receptionist",
  "description": "Receptionist with additional customer edit rights",
  "permission_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Template usage response:**
```json
{
  "template_id": "uuid",
  "user_count": 4,
  "users": [{ "id": "...", "name": "...", "email": "..." }]
}
```

---

## Frontend Architecture

### New/Modified Files

```
crm-frontend/src/
├── store/
│   └── authStore.ts                  # MODIFIED — permissions[], mustChangePassword
├── hooks/
│   ├── useAuth.ts                    # MODIFIED — handle mustChangePassword redirect
│   ├── usePermission.ts              # NEW
│   ├── useUsers.ts                   # NEW
│   └── useRoleTemplates.ts           # NEW
├── lib/
│   └── permissions.ts                # NEW — permission code constants
├── components/
│   ├── auth/
│   │   └── PermissionGuard.tsx       # NEW — conditional render wrapper
│   └── role-templates/
│       └── PermissionMatrix.tsx      # NEW — module × action checkbox grid
└── app/
    ├── (auth)/
    │   └── change-password/
    │       └── page.tsx              # NEW — forced password change
    └── (dashboard)/
        ├── layout.tsx                # MODIFIED — mustChangePassword redirect
        ├── users/
        │   ├── page.tsx              # NEW — user list
        │   └── [id]/page.tsx         # NEW — user detail + audit trail
        └── role-templates/
            ├── page.tsx              # NEW — template list
            └── [id]/page.tsx         # NEW — template detail + permission matrix
```

### Permission Store Extension

```typescript
interface AuthState {
  token: string | null
  user: AdminUser | null
  permissions: string[]
  mustChangePassword: boolean
  setAuth: (token, user, permissions, mustChangePassword) => void
  clearAuth: () => void
  hasPermission: (code: string) => boolean
}
```

### `usePermission` Hook

```typescript
const canCreate = usePermission("appointments.create")  // boolean

const { canView, canEdit } = usePermissions({
  canView: "appointments.view",
  canEdit: "appointments.update",
})
```

### `PermissionGuard` Component

```tsx
<PermissionGuard permission="services.create">
  <Button>Create Service</Button>
</PermissionGuard>

<PermissionGuard permission="customers.update" fallback={<ReadOnlyBadge />}>
  <EditCustomerButton />
</PermissionGuard>
```

### Route Guard Flow (dashboard layout)

1. No token → redirect `/login`
2. `mustChangePassword === true` → redirect `/change-password`
3. Page renders → page-level `usePermission` check → `<UnauthorizedPage />` if denied

### Sidebar Navigation

Nav items filtered by permission before render:
```typescript
const navItems = [
  { label: "Dashboard",    href: "/dashboard",       permission: "dashboard.view" },
  { label: "Appointments", href: "/appointments",    permission: "appointments.view" },
  { label: "Customers",    href: "/customers",       permission: "customers.view" },
  { label: "Services",     href: "/services",        permission: "services.view" },
  { label: "Providers",    href: "/providers",       permission: "providers.view" },
  { label: "Leads",        href: "/leads",           permission: "leads.view" },
  { label: "Users",        href: "/users",           permission: "users.view" },
  { label: "Roles",        href: "/role-templates",  permission: "roles.view" },
  { label: "Settings",     href: "/settings",        permission: "settings.view" },
]
```

### Permission Matrix UI

Grid with rows = modules, columns = actions, checkboxes per cell. Features:
- Select all per row (module) and per column (action)
- System templates render as read-only (indicators, no checkboxes)
- Save replaces full permission set via `PATCH /role-templates/{id}/permissions`

---

## Seed Strategy

### Execution

`app/db/seed.py` — two idempotent functions:
- `seed_permissions()` — upsert all ~52 permission rows by `code`
- `seed_system_templates()` — upsert all 5 templates + permission links by `name`

Run on startup in dev via `main.py` lifespan, or manually:
```bash
python -m app.db.seed
```

---

## Security Considerations

- **Password policy**: min 8 chars, uppercase + lowercase + digit + special char. Validated at API level on create and change-password.
- **JTI blacklist**: Redis-based, TTL = remaining token lifetime. Triggered on deactivate, template change, password reset.
- **Privilege escalation**: Users cannot assign themselves higher-permission templates, cannot deactivate own account, cannot use admin reset on themselves.
- **System template protection**: `is_system=true` blocks edit/delete at service layer (not just router). Clone always allowed.
- **Account lockout**: 5 failed attempts → locked 15 minutes. Admin can unlock via activate endpoint.
- **Soft delete only**: Users set `is_active=false`. Templates blocked from delete if users assigned (409 response).
- **Frontend security**: Permissions in Zustand are UX-only. Backend always authorizes independently.
- **Token TTL**: Reduced from 8 hours to 4 hours.

---

## Future Enhancements

- Email-based password reset link (requires SMTP integration)
- Per-resource ownership rules (e.g. receptionist can only edit appointments they created)
- Multi-tenant support (clinic branches)
- SSO / OAuth2 login
- Fine-grained audit log search and export
- Permission groups / bundles for faster template creation
