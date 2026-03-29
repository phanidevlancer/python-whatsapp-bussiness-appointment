'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  BadgeAlert,
  BriefcaseMedical,
  CalendarClock,
  Mail,
  Pencil,
  Phone,
  Power,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  UserCog,
  UserRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useDeactivateUser, useActivateUser, useAdminPasswordReset, useAssignUserTemplate, useForcePasswordReset, useUpdateUser, useUserAuditLog, useUserDetail, type UserUpdateRequest } from '@/hooks/useUsers';
import { usePermission } from '@/hooks/usePermission';
import PermissionGuard from '@/components/auth/PermissionGuard';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardSubtitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmChangeDialog, type FieldChange } from '@/components/ui/ConfirmChangeDialog';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { PERMISSIONS } from '@/lib/permissions';

interface RoleTemplateOption {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  assigned_user_count?: number;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy h:mm a');
}

function auditDetails(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '—';
  }
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canViewUsers = usePermission(PERMISSIONS.users.view);
  const canManageUsers = usePermission(PERMISSIONS.users.manage);
  const { data: user, isLoading } = useUserDetail(id, { enabled: canViewUsers });
  const { data: auditLog, isLoading: auditLoading } = useUserAuditLog(id, { enabled: canViewUsers });
  const { mutate: updateUser, isPending: updatingUser } = useUpdateUser();
  const { mutate: deactivateUser, isPending: deactivatingUser } = useDeactivateUser();
  const { mutate: activateUser, isPending: activatingUser } = useActivateUser();
  const { mutate: assignTemplate, isPending: assigningTemplate } = useAssignUserTemplate();
  const { mutate: forcePasswordReset, isPending: forcingReset } = useForcePasswordReset();
  const { mutate: adminResetPassword, isPending: adminResettingPassword } = useAdminPasswordReset();

  const { data: templates } = useQuery({
    queryKey: ['role-templates', 'users-form'],
    queryFn: async () => {
      const res = await api.get<RoleTemplateOption[]>('/api/v1/role-templates');
      return res.data;
    },
    enabled: canManageUsers,
  });

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmployeeCode, setEditEmployeeCode] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);
  const [pendingUpdate, setPendingUpdate] = useState<UserUpdateRequest | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState('');

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      setEditName(user.name ?? '');
      setEditEmail(user.email ?? '');
      setEditPhone(user.phone ?? '');
      setEditEmployeeCode(user.employee_code ?? '');
      setSelectedTemplateId(user.template_id ?? '');
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user]);

  const templateOptions = useMemo(
    () => (templates ?? []).filter((template) => template.is_active),
    [templates]
  );

  const startEditing = () => {
    if (!user) return;
    setEditName(user.name ?? '');
    setEditEmail(user.email ?? '');
    setEditPhone(user.phone ?? '');
    setEditEmployeeCode(user.employee_code ?? '');
    setEditing(true);
  };

  const requestSave = () => {
    if (!user) return;
    const changes: FieldChange[] = [];
    const payload: UserUpdateRequest = {};

    if (editName !== user.name) {
      changes.push({ field: 'name', label: 'Name', oldValue: user.name, newValue: editName });
      payload.name = editName;
    }
    if (editEmail !== user.email) {
      changes.push({ field: 'email', label: 'Email', oldValue: user.email, newValue: editEmail });
      payload.email = editEmail;
    }
    if ((editPhone || null) !== (user.phone ?? null)) {
      changes.push({ field: 'phone', label: 'Phone', oldValue: user.phone, newValue: editPhone });
      payload.phone = editPhone || null;
    }
    if ((editEmployeeCode || null) !== (user.employee_code ?? null)) {
      changes.push({
        field: 'employee_code',
        label: 'Employee Code',
        oldValue: user.employee_code,
        newValue: editEmployeeCode,
      });
      payload.employee_code = editEmployeeCode || null;
    }

    if (!changes.length) {
      toast('No changes to save');
      setEditing(false);
      return;
    }

    setPendingChanges(changes);
    setPendingUpdate(payload);
    setShowConfirm(true);
  };

  const confirmSave = () => {
    if (!user || !pendingUpdate) return;
    updateUser(
      { id: user.id, ...pendingUpdate },
      {
        onSuccess: () => {
          toast.success('User updated');
          setShowConfirm(false);
          setPendingUpdate(null);
          setPendingChanges([]);
          setEditing(false);
        },
        onError: (err: unknown) => {
          const message =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
              ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
              : 'Failed to update user';
          toast.error(message);
          setShowConfirm(false);
        },
      }
    );
  };

  const handleAssignTemplate = () => {
    if (!user) return;
    if (selectedTemplateId === (user.template_id ?? '')) {
      toast('Template unchanged');
      return;
    }
    if (!selectedTemplateId) {
      toast.error('Choose a template first');
      return;
    }
    assignTemplate(
      { id: user.id, template_id: selectedTemplateId },
      {
        onSuccess: () => toast.success('Template assigned'),
        onError: (err: unknown) => {
          const message =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
              ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
              : 'Failed to assign template';
          toast.error(message);
        },
      }
    );
  };

  const handleDeactivate = () => {
    if (!user) return;
    deactivateUser(user.id, {
      onSuccess: () => toast.success('User deactivated'),
      onError: (err: unknown) => {
        const message =
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
            ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
            : 'Failed to deactivate user';
        toast.error(message);
      },
    });
  };

  const handleActivate = () => {
    if (!user) return;
    activateUser(user.id, {
      onSuccess: () => toast.success('User activated'),
      onError: (err: unknown) => {
        const message =
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
            ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
            : 'Failed to activate user';
        toast.error(message);
      },
    });
  };

  const handleForceReset = () => {
    if (!user) return;
    forcePasswordReset(
      { id: user.id, must_change_password: true },
      {
        onSuccess: () => toast.success('Password reset forced'),
        onError: (err: unknown) => {
          const message =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
              ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
              : 'Failed to force password reset';
          toast.error(message);
        },
      }
    );
  };

  const resetPasswordModalState = () => {
    setShowResetPasswordModal(false);
    setTemporaryPassword('');
    setConfirmTemporaryPassword('');
  };

  const handleAdminPasswordReset = () => {
    if (!user) return;
    if (!temporaryPassword || !confirmTemporaryPassword) {
      toast.error('Enter and confirm the temporary password');
      return;
    }
    if (temporaryPassword !== confirmTemporaryPassword) {
      toast.error('Temporary passwords do not match');
      return;
    }

    adminResetPassword(
      { user_id: user.id, new_password: temporaryPassword },
      {
        onSuccess: () => {
          toast.success('Temporary password updated. User must change it on next login.');
          resetPasswordModalState();
        },
        onError: (err: unknown) => {
          const message =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
              ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
              : 'Failed to reset password';
          toast.error(message);
        },
      }
    );
  };

  if (!canViewUsers) {
    return (
      <Card className="p-8 text-center" variant="elevated">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <ShieldX size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Access denied</h2>
        <p className="mt-1 text-sm text-slate-500">
          You do not have permission to view users.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" className="w-20 h-4" />
        </div>
        <Card className="p-6" variant="elevated">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton variant="circular" width={64} height={64} />
              <div className="space-y-2">
                <Skeleton variant="text" className="w-48 h-5" />
                <Skeleton variant="text" className="w-64 h-4" />
              </div>
            </div>
            <Skeleton variant="rounded" className="w-24 h-8" />
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-6xl">
        <Card className="p-8 text-center" variant="elevated">
          <h3 className="text-sm font-medium text-slate-900 mb-1">User not found</h3>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-3">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  const pendingReset = user.must_change_password || user.is_first_login;

  return (
    <div className="max-w-6xl space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6" variant="elevated">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Avatar name={user.name} size="lg" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{user.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                    <Mail size={14} />
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={user.is_active ? 'success' : 'error'} size="lg" dot>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
                {pendingReset ? (
                  <Badge variant="warning" size="lg">
                    Password reset pending
                  </Badge>
                ) : null}
              </div>
            </div>

            {!editing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoTile icon={<Phone size={14} />} label="Phone" value={user.phone ?? '—'} />
                <InfoTile icon={<UserRound size={14} />} label="Employee Code" value={user.employee_code ?? '—'} />
                <InfoTile icon={<BriefcaseMedical size={14} />} label="Template" value={user.template_name ?? 'Unassigned'} />
                <InfoTile icon={<CalendarClock size={14} />} label="Created" value={formatDate(user.created_at)} />
                <InfoTile icon={<BadgeAlert size={14} />} label="Failed logins" value={String(user.failed_login_attempts)} />
                <InfoTile icon={<ShieldCheck size={14} />} label="Locked until" value={formatDate(user.locked_until)} />
                <InfoTile icon={<RotateCcw size={14} />} label="Last login" value={formatDate(user.last_login_at)} />
                <InfoTile icon={<UserCog size={14} />} label="Role" value={user.role} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                <Input label="Employee Code" value={editEmployeeCode} onChange={(e) => setEditEmployeeCode(e.target.value)} />
                <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
                  <Button variant="outline" size="md" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <PermissionGuard permission={PERMISSIONS.users.update}>
                    <Button variant="primary" size="md" leftIcon={<Pencil size={14} />} onClick={requestSave}>
                      Save Changes
                    </Button>
                  </PermissionGuard>
                </div>
              </div>
            )}

            {!editing ? (
              <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-slate-100">
                <PermissionGuard permission={PERMISSIONS.users.update}>
                  <Button variant="outline" size="md" leftIcon={<Pencil size={16} />} onClick={startEditing}>
                    Edit Profile
                  </Button>
                </PermissionGuard>
              </div>
            ) : null}
          </Card>

          <Card className="p-6" variant="elevated">
            <CardHeader className="pb-4 border-0">
              <div>
                <CardTitle>Audit Log</CardTitle>
                <CardSubtitle>Recent account activity and state changes</CardSubtitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {auditLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} variant="text" className="h-4 w-full" />
                  ))}
                </div>
              ) : !auditLog?.length ? (
                <p className="text-sm text-slate-500">No audit events</p>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900 capitalize">
                            {entry.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {entry.performed_by_name ?? 'System'} • {formatDate(entry.created_at)}
                          </p>
                        </div>
                        <Badge variant="default" size="sm">
                          {entry.action}
                        </Badge>
                      </div>
                      {entry.details_json ? (
                        <p className="mt-2 text-xs text-slate-600 break-words">
                          {auditDetails(entry.details_json)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canManageUsers ? (
            <>
            <Card className="p-6" variant="elevated">
              <CardHeader className="pb-4 border-0">
                <div>
                  <CardTitle>Role Template</CardTitle>
                  <CardSubtitle>Assign the template that controls this account’s permissions</CardSubtitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Template</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {(templateOptions ?? []).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.is_system ? ' (system)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={handleAssignTemplate}
                  isLoading={assigningTemplate}
                >
                  Assign Template
                </Button>
              </CardContent>
            </Card>

            <Card className="p-6" variant="elevated">
              <CardHeader className="pb-4 border-0">
                <div>
                  <CardTitle>Account Controls</CardTitle>
                  <CardSubtitle>State changes and credential resets</CardSubtitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <Button
                  variant={user.is_active ? 'danger' : 'success'}
                  size="md"
                  className="w-full"
                  leftIcon={<Power size={16} />}
                  onClick={user.is_active ? handleDeactivate : handleActivate}
                  isLoading={deactivatingUser || activatingUser}
                >
                  {user.is_active ? 'Deactivate User' : 'Activate User'}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={handleForceReset}
                  isLoading={forcingReset}
                >
                  Force Password Reset
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={() => setShowResetPasswordModal(true)}
                >
                  Set Temporary Password
                </Button>
              </CardContent>
            </Card>
            </>
          ) : (
            <Card className="p-6" variant="elevated">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Manage permission required to change templates, activate or deactivate users, and force password resets.
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmChangeDialog
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingUpdate(null);
          setPendingChanges([]);
        }}
        onConfirm={confirmSave}
        isLoading={updatingUser}
        title="Confirm user changes"
        changes={pendingChanges}
      />

      <Modal isOpen={showResetPasswordModal} onClose={resetPasswordModalState} size="md">
        <ModalHeader>
          <ModalTitle>Set Temporary Password</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Set a temporary password for {user.name}. They will be required to change it on next login.
          </p>
          <Input
            label="Temporary Password"
            type="password"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            helperText="Must meet the password policy."
          />
          <Input
            label="Confirm Temporary Password"
            type="password"
            value={confirmTemporaryPassword}
            onChange={(e) => setConfirmTemporaryPassword(e.target.value)}
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="md" onClick={resetPasswordModalState} disabled={adminResettingPassword}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleAdminPasswordReset} isLoading={adminResettingPassword}>
            Reset Password
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  );
}
