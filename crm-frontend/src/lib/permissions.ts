export const PERMISSIONS = {
  dashboard: {
    view: 'dashboard.view',
  },
  appointments: {
    view: 'appointments.view',
    create: 'appointments.create',
    update: 'appointments.update',
    delete: 'appointments.delete',
    reschedule: 'appointments.reschedule',
    cancel: 'appointments.cancel',
    export: 'appointments.export',
  },
  customers: {
    view: 'customers.view',
    create: 'customers.create',
    update: 'customers.update',
    delete: 'customers.delete',
    export: 'customers.export',
    partialUpdateContact: 'customers.partial_update_contact',
  },
  services: {
    view: 'services.view',
    create: 'services.create',
    update: 'services.update',
    delete: 'services.delete',
    manage: 'services.manage',
  },
  providers: {
    view: 'providers.view',
    create: 'providers.create',
    update: 'providers.update',
    delete: 'providers.delete',
    manage: 'providers.manage',
  },
  slots: {
    view: 'slots.view',
    create: 'slots.create',
    update: 'slots.update',
    delete: 'slots.delete',
    manage: 'slots.manage',
  },
  leads: {
    view: 'leads.view',
    update: 'leads.update',
    assign: 'leads.assign',
    export: 'leads.export',
  },
  notifications: {
    view: 'notifications.view',
    manage: 'notifications.manage',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
    manage: 'users.manage',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
    manage: 'roles.manage',
  },
  reports: {
    view: 'reports.view',
    export: 'reports.export',
  },
  settings: {
    view: 'settings.view',
    manage: 'settings.manage',
  },
} as const;

export type PermissionCode =
  | typeof PERMISSIONS.dashboard.view
  | typeof PERMISSIONS.appointments.view
  | typeof PERMISSIONS.appointments.create
  | typeof PERMISSIONS.appointments.update
  | typeof PERMISSIONS.appointments.delete
  | typeof PERMISSIONS.appointments.reschedule
  | typeof PERMISSIONS.appointments.cancel
  | typeof PERMISSIONS.appointments.export
  | typeof PERMISSIONS.customers.view
  | typeof PERMISSIONS.customers.create
  | typeof PERMISSIONS.customers.update
  | typeof PERMISSIONS.customers.delete
  | typeof PERMISSIONS.customers.export
  | typeof PERMISSIONS.customers.partialUpdateContact
  | typeof PERMISSIONS.services.view
  | typeof PERMISSIONS.services.create
  | typeof PERMISSIONS.services.update
  | typeof PERMISSIONS.services.delete
  | typeof PERMISSIONS.services.manage
  | typeof PERMISSIONS.providers.view
  | typeof PERMISSIONS.providers.create
  | typeof PERMISSIONS.providers.update
  | typeof PERMISSIONS.providers.delete
  | typeof PERMISSIONS.providers.manage
  | typeof PERMISSIONS.slots.view
  | typeof PERMISSIONS.slots.create
  | typeof PERMISSIONS.slots.update
  | typeof PERMISSIONS.slots.delete
  | typeof PERMISSIONS.slots.manage
  | typeof PERMISSIONS.leads.view
  | typeof PERMISSIONS.leads.update
  | typeof PERMISSIONS.leads.assign
  | typeof PERMISSIONS.leads.export
  | typeof PERMISSIONS.notifications.view
  | typeof PERMISSIONS.notifications.manage
  | typeof PERMISSIONS.users.view
  | typeof PERMISSIONS.users.create
  | typeof PERMISSIONS.users.update
  | typeof PERMISSIONS.users.delete
  | typeof PERMISSIONS.users.manage
  | typeof PERMISSIONS.roles.view
  | typeof PERMISSIONS.roles.create
  | typeof PERMISSIONS.roles.update
  | typeof PERMISSIONS.roles.delete
  | typeof PERMISSIONS.roles.manage
  | typeof PERMISSIONS.reports.view
  | typeof PERMISSIONS.reports.export
  | typeof PERMISSIONS.settings.view
  | typeof PERMISSIONS.settings.manage;

export const PERMISSION_GROUPS: Array<{ module: string; permissions: PermissionCode[] }> = [
  {
    module: 'dashboard',
    permissions: [PERMISSIONS.dashboard.view],
  },
  {
    module: 'appointments',
    permissions: [
      PERMISSIONS.appointments.view,
      PERMISSIONS.appointments.create,
      PERMISSIONS.appointments.update,
      PERMISSIONS.appointments.delete,
      PERMISSIONS.appointments.reschedule,
      PERMISSIONS.appointments.cancel,
      PERMISSIONS.appointments.export,
    ],
  },
  {
    module: 'customers',
    permissions: [
      PERMISSIONS.customers.view,
      PERMISSIONS.customers.create,
      PERMISSIONS.customers.update,
      PERMISSIONS.customers.delete,
      PERMISSIONS.customers.export,
      PERMISSIONS.customers.partialUpdateContact,
    ],
  },
  {
    module: 'services',
    permissions: [
      PERMISSIONS.services.view,
      PERMISSIONS.services.create,
      PERMISSIONS.services.update,
      PERMISSIONS.services.delete,
      PERMISSIONS.services.manage,
    ],
  },
  {
    module: 'providers',
    permissions: [
      PERMISSIONS.providers.view,
      PERMISSIONS.providers.create,
      PERMISSIONS.providers.update,
      PERMISSIONS.providers.delete,
      PERMISSIONS.providers.manage,
    ],
  },
  {
    module: 'slots',
    permissions: [
      PERMISSIONS.slots.view,
      PERMISSIONS.slots.create,
      PERMISSIONS.slots.update,
      PERMISSIONS.slots.delete,
      PERMISSIONS.slots.manage,
    ],
  },
  {
    module: 'leads',
    permissions: [
      PERMISSIONS.leads.view,
      PERMISSIONS.leads.update,
      PERMISSIONS.leads.assign,
      PERMISSIONS.leads.export,
    ],
  },
  {
    module: 'notifications',
    permissions: [PERMISSIONS.notifications.view, PERMISSIONS.notifications.manage],
  },
  {
    module: 'users',
    permissions: [
      PERMISSIONS.users.view,
      PERMISSIONS.users.create,
      PERMISSIONS.users.update,
      PERMISSIONS.users.delete,
      PERMISSIONS.users.manage,
    ],
  },
  {
    module: 'roles',
    permissions: [
      PERMISSIONS.roles.view,
      PERMISSIONS.roles.create,
      PERMISSIONS.roles.update,
      PERMISSIONS.roles.delete,
      PERMISSIONS.roles.manage,
    ],
  },
  {
    module: 'reports',
    permissions: [PERMISSIONS.reports.view, PERMISSIONS.reports.export],
  },
  {
    module: 'settings',
    permissions: [PERMISSIONS.settings.view, PERMISSIONS.settings.manage],
  },
];

export function flattenPermissions() {
  return PERMISSION_GROUPS.flatMap((group) => group.permissions);
}
