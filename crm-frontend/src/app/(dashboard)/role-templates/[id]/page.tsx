'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Copy, Pencil, Shield, ShieldX, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import PermissionGuard from '@/components/auth/PermissionGuard';
import PermissionMatrix from '@/components/role-templates/PermissionMatrix';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardSubtitle, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePermission } from '@/hooks/usePermission';
import {
  getRoleTemplatePermissionCodes,
  resolvePermissionIdsFromCodes,
  useCopyRoleTemplate,
  useDeleteRoleTemplate,
  usePermissionCatalog,
  useRoleTemplate,
  useRoleTemplateUsage,
  useUpdateRoleTemplate,
  useUpdateRoleTemplatePermissions,
} from '@/hooks/useRoleTemplates';
import { PERMISSIONS } from '@/lib/permissions';
import type { PermissionCode } from '@/lib/permissions';

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
  ) {
    return (error as { response?: { data?: { detail?: string } } }).response!.data!.detail!;
  }
  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy h:mm a');
}

export default function RoleTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canViewRoles = usePermission(PERMISSIONS.roles.view);

  const { data: template, isLoading } = useRoleTemplate(id, { enabled: canViewRoles });
  const { data: usage } = useRoleTemplateUsage(id, { enabled: canViewRoles });
  const { data: catalog } = usePermissionCatalog(canViewRoles);
  const { mutateAsync: updateTemplate, isPending: updatingTemplate } = useUpdateRoleTemplate();
  const { mutateAsync: updatePermissions, isPending: updatingPermissions } = useUpdateRoleTemplatePermissions();
  const { mutateAsync: copyTemplate, isPending: copyingTemplate } = useCopyRoleTemplate();
  const { mutateAsync: deleteTemplate, isPending: deletingTemplate } = useDeleteRoleTemplate();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionCode[]>([]);
  const [copyName, setCopyName] = useState('');
  const [copyDescription, setCopyDescription] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [warningAction, setWarningAction] = useState<'save' | 'delete' | null>(null);

  const templatePermissionCodes = useMemo(() => getRoleTemplatePermissionCodes(template), [template]);
  const permissionChanged = useMemo(() => {
    const current = new Set(templatePermissionCodes);
    const next = new Set(selectedPermissions);
    if (current.size !== next.size) return true;
    for (const code of current) {
      if (!next.has(code)) return true;
    }
    return false;
  }, [selectedPermissions, templatePermissionCodes]);
  const metadataChanged =
    template ? editName !== template.name || editDescription !== (template.description ?? '') : false;
  const assignedCount = usage?.user_count ?? template?.assigned_user_count ?? 0;
  const isReadOnly = Boolean(template?.is_system);
  const isDirty = permissionChanged || metadataChanged;
  const shouldWarnBeforeMutation = assignedCount > 0 && !isReadOnly;
  const selectedPermissionIds = useMemo(
    () => resolvePermissionIdsFromCodes(selectedPermissions, catalog, template?.permissions),
    [selectedPermissions, catalog, template?.permissions]
  );

  const startEditing = () => {
    if (!template || isReadOnly) return;
    setEditName(template.name);
    setEditDescription(template.description ?? '');
    setSelectedPermissions(getRoleTemplatePermissionCodes(template));
    setEditing(true);
  };

  if (!canViewRoles) {
    return (
      <Card className="p-8 text-center" variant="elevated">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <ShieldX size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Access denied</h2>
        <p className="mt-1 text-sm text-slate-500">You do not have permission to view role templates.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="text" className="h-4 w-24" />
        <Card className="p-6" variant="elevated">
          <div className="space-y-3">
            <Skeleton variant="text" className="h-5 w-48" />
            <Skeleton variant="text" className="h-4 w-72" />
          </div>
        </Card>
      </div>
    );
  }

  if (!template) {
    return (
      <Card className="p-8 text-center" variant="elevated">
        <h3 className="text-sm font-medium text-slate-900">Role template not found</h3>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.back()}>
          Go Back
        </Button>
      </Card>
    );
  }

  const handleSave = async (force = false) => {
    if (!isDirty) {
      toast('No changes to save');
      setEditing(false);
      return;
    }

    if (template.is_system) {
      toast.error('System templates are read-only');
      return;
    }

    if (shouldWarnBeforeMutation && !force) {
      setWarningAction('save');
      return;
    }

    try {
      if (metadataChanged) {
        await updateTemplate({
          id: template.id,
          name: editName.trim(),
          description: editDescription.trim() || null,
        });
      }
      if (permissionChanged) {
        if (selectedPermissionIds.length !== selectedPermissions.length) {
          toast.error('Unable to resolve one or more permission IDs');
          return;
        }
        await updatePermissions({
          id: template.id,
          permission_ids: selectedPermissionIds,
        });
      }
      toast.success('Role template updated');
      setEditing(false);
      setWarningAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update role template'));
    }
  };

  const confirmDelete = async (force = false) => {
    if (template.is_system) {
      toast.error('System templates cannot be deleted');
      return;
    }

    if (shouldWarnBeforeMutation && !force) {
      setWarningAction('delete');
      return;
    }

    try {
      await deleteTemplate(template.id);
      toast.success('Role template deleted');
      router.push('/role-templates');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete role template'));
    }
  };

  const handleCopy = async () => {
    if (!copyName.trim()) {
      toast.error('Copy name is required');
      return;
    }

    try {
      const copied = await copyTemplate({
        id: template.id,
        name: copyName.trim(),
        description: copyDescription.trim() || null,
      });
      toast.success('Template copied');
      setShowCopyModal(false);
      router.push(`/role-templates/${copied.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to copy role template'));
    }
  };

  const openCopyModal = () => {
    setCopyName(`${template.name} Copy`);
    setCopyDescription(template.description ?? '');
    setShowCopyModal(true);
  };

  const closeUsageWarning = () => {
    setWarningAction(null);
  };

  const usageWarningMessage =
    warningAction === 'delete'
      ? `This template is currently assigned to ${assignedCount} users. Deleting it will be blocked until those users are moved to another template.`
      : `This template is assigned to ${assignedCount} users. Saving changes will immediately change the permissions for those accounts.`;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{template.name}</h2>
            <Badge variant={template.is_system ? 'warning' : 'default'} size="sm">
              {template.is_system ? 'System' : 'Custom'}
            </Badge>
            <Badge variant={template.is_active ? 'success' : 'error'} size="sm" dot>
              {template.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-slate-500">
            {template.description ?? 'No description provided'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary" size="lg">
            <Users size={16} />
            {assignedCount} users
          </Badge>
            <Badge variant="default" size="lg">
              <Shield size={16} />
            {selectedPermissionIds.length} permissions
            </Badge>
          <PermissionGuard permission={PERMISSIONS.roles.create}>
            <Button
              variant="outline"
              size="md"
              leftIcon={<Copy size={16} />}
              onClick={openCopyModal}
            >
              Copy Template
            </Button>
          </PermissionGuard>
          {!isReadOnly ? (
            <>
              <PermissionGuard permission={PERMISSIONS.roles.update}>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Pencil size={16} />}
                  onClick={editing ? () => setEditing(false) : startEditing}
                >
                  {editing ? 'Editing' : 'Edit Template'}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={PERMISSIONS.roles.delete}>
                <Button
                  variant="danger"
                  size="md"
                  leftIcon={<Trash2 size={16} />}
                  onClick={confirmDelete}
                  isLoading={deletingTemplate}
                >
                  Delete
                </Button>
              </PermissionGuard>
            </>
          ) : null}
        </div>
      </div>

      {isReadOnly ? (
        <Card className="border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900" variant="outlined">
          System templates are read-only. You can copy this template, but edits and deletes are blocked.
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <Card className="p-6" variant="elevated">
          <CardHeader className="border-0 pb-4">
            <div>
              <CardTitle>Template details</CardTitle>
              <CardSubtitle>Basic information and usage summary</CardSubtitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {!editing || isReadOnly ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoTile label="Template ID" value={template.id} />
                  <InfoTile label="Assigned users" value={String(assignedCount)} />
                  <InfoTile label="Created" value={formatDate(template.created_at)} />
                  <InfoTile label="Updated" value={formatDate(template.updated_at)} />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {usage?.users?.length ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Assigned users</p>
                      <div className="space-y-1">
                        {usage.users.map((user) => (
                          <div key={user.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-slate-800">{user.name}</span>
                            <span className="text-slate-500">{user.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p>No users assigned to this template.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <Input label="Template name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Input
                  label="Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional template description"
                />
                <div className="flex items-center justify-end gap-3">
                  <Button variant="outline" size="md" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <PermissionGuard permission={PERMISSIONS.roles.update}>
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Pencil size={14} />}
                    onClick={() => {
                      void handleSave();
                    }}
                      isLoading={updatingTemplate || updatingPermissions}
                    >
                      Save Changes
                  </Button>
                </PermissionGuard>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <PermissionMatrix
          groups={catalog?.length ? catalog : undefined}
          selectedPermissions={selectedPermissions}
          onChange={setSelectedPermissions}
          readOnly={isReadOnly || !editing}
        />
      </div>

      <Modal isOpen={showCopyModal} onClose={() => setShowCopyModal(false)} size="md">
        <ModalHeader>
          <ModalTitle>Copy role template</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This will duplicate the permission set into a new editable template.
          </div>
          <Input label="New template name" value={copyName} onChange={(e) => setCopyName(e.target.value)} />
          <Input
            label="Description"
            value={copyDescription}
            onChange={(e) => setCopyDescription(e.target.value)}
            placeholder="Optional description for the copy"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="md" onClick={() => setShowCopyModal(false)} disabled={copyingTemplate}>
            Cancel
          </Button>
          <Button variant="primary" size="md" leftIcon={<Copy size={14} />} onClick={handleCopy} isLoading={copyingTemplate}>
            Copy Template
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={warningAction !== null} onClose={closeUsageWarning} size="md">
        <ModalHeader>
          <ModalTitle>Usage warning</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {usageWarningMessage}
          </div>
          {warningAction !== 'delete' ? (
            <p className="text-sm text-slate-500">
              Continue only if you want those updates to apply immediately.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Deleting is still blocked while users are assigned, but this warning helps prevent accidental data loss.
            </p>
          )}
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="md" onClick={closeUsageWarning}>
            Cancel
          </Button>
          <Button
            variant={warningAction === 'delete' ? 'danger' : 'primary'}
            size="md"
            onClick={async () => {
              const action = warningAction;
              setWarningAction(null);
              if (action === 'delete') {
                await confirmDelete(true);
                return;
              }
              await handleSave(true);
            }}
          >
            Continue
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
