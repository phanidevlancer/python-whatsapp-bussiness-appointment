'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Copy, Plus, Shield, ShieldX, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/auth/PermissionGuard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePermission } from '@/hooks/usePermission';
import {
  useCreateRoleTemplate,
  useCopyRoleTemplate,
  useDeleteRoleTemplate,
  useRoleTemplates,
  type RoleTemplateRead,
} from '@/hooks/useRoleTemplates';
import { PERMISSIONS } from '@/lib/permissions';

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

export default function RoleTemplatesPage() {
  const router = useRouter();
  const canViewRoles = usePermission(PERMISSIONS.roles.view);
  const canDeleteRoles = usePermission(PERMISSIONS.roles.delete);
  const { data: templates, isLoading } = useRoleTemplates({ enabled: canViewRoles });
  const { mutateAsync: createTemplate, isPending: creatingTemplate } = useCreateRoleTemplate();
  const { mutateAsync: copyTemplate, isPending: copyingTemplate } = useCopyRoleTemplate();
  const { mutateAsync: deleteTemplate, isPending: deletingTemplate } = useDeleteRoleTemplate();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [copyTarget, setCopyTarget] = useState<RoleTemplateRead | null>(null);
  const [copyName, setCopyName] = useState('');
  const [copyDescription, setCopyDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RoleTemplateRead | null>(null);

  const systemCount = useMemo(() => templates?.filter((template) => template.is_system).length ?? 0, [templates]);

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

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      const template = await createTemplate({
        name: createName.trim(),
        description: createDescription.trim() || null,
      });
      toast.success('Role template created');
      setShowCreateModal(false);
      setCreateName('');
      setCreateDescription('');
      router.push(`/role-templates/${template.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create role template'));
    }
  };

  const handleCopy = async () => {
    if (!copyTarget) return;
    if (!copyName.trim()) {
      toast.error('Copy name is required');
      return;
    }

    try {
      const template = await copyTemplate({
        id: copyTarget.id,
        name: copyName.trim(),
        description: copyDescription.trim() || null,
      });
      toast.success('Template copied');
      setCopyTarget(null);
      setCopyName('');
      setCopyDescription('');
      router.push(`/role-templates/${template.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to copy role template'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTemplate(deleteTarget.id);
      toast.success('Role template deleted');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete role template'));
    }
  };

  const openCopyModal = (template: RoleTemplateRead) => {
    setCopyTarget(template);
    setCopyName(`${template.name} Copy`);
    setCopyDescription(template.description ?? '');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Role Templates</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage permission sets for staff roles and clone system templates for custom variants.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary" size="lg">
            <Shield size={16} />
            {templates?.length ?? 0} templates
          </Badge>
          <Badge variant="default" size="lg">
            <Users size={16} />
            {systemCount} system
          </Badge>
          <PermissionGuard permission={PERMISSIONS.roles.create}>
            <Button variant="primary" size="md" leftIcon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>
              New Template
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <Card className="overflow-hidden p-0" variant="elevated">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton variant="text" className="h-4 w-1/4" />
                <Skeleton variant="text" className="h-4 w-1/5" />
                <Skeleton variant="text" className="h-4 w-1/6" />
              </div>
            ))}
          </div>
        ) : !templates?.length ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Shield size={32} />
            </div>
            <h3 className="text-sm font-medium text-slate-900">No role templates found</h3>
            <p className="mt-1 text-sm text-slate-500">Create a template or copy one of the system defaults.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Template</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Users</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Permissions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">State</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                          <Shield size={18} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{template.name}</p>
                          <p className="text-xs text-slate-500">{template.description ?? 'No description provided'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{template.assigned_user_count}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{template.permission_count ?? template.permission_ids?.length ?? template.permission_codes?.length ?? template.permissions?.length ?? 0}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={template.is_system ? 'warning' : 'default'} size="sm">
                          {template.is_system ? 'System' : 'Custom'}
                        </Badge>
                        <Badge variant={template.is_active ? 'success' : 'error'} size="sm" dot>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {template.updated_at ? format(new Date(template.updated_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/role-templates/${template.id}`)}
                        >
                          View
                        </Button>
                        <PermissionGuard permission={PERMISSIONS.roles.create}>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Copy size={14} />}
                            onClick={() => openCopyModal(template)}
                          >
                            Copy
                          </Button>
                        </PermissionGuard>
                        {canDeleteRoles && !template.is_system ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeleteTarget(template)}
                            disabled={deletingTemplate}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} size="md">
        <ModalHeader>
          <ModalTitle>Create role template</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4">
          <Input label="Template name" value={createName} onChange={(e) => setCreateName(e.target.value)} />
          <Input
            label="Description"
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
            placeholder="Optional notes for this template"
          />
          <p className="text-sm text-slate-500">
            Permissions are assigned on the template detail page after creation.
          </p>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="md" onClick={() => setShowCreateModal(false)} disabled={creatingTemplate}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleCreate} isLoading={creatingTemplate}>
            Create
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(copyTarget)} onClose={() => setCopyTarget(null)} size="md">
        <ModalHeader>
          <ModalTitle>Copy role template</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Copying <span className="font-medium">{copyTarget?.name}</span> will duplicate its permission set and create a new editable template.
          </div>
          <Input label="New template name" value={copyName} onChange={(e) => setCopyName(e.target.value)} />
          <Input
            label="Description"
            value={copyDescription}
            onChange={(e) => setCopyDescription(e.target.value)}
            placeholder="Optional notes for the copy"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="md" onClick={() => setCopyTarget(null)} disabled={copyingTemplate}>
            Cancel
          </Button>
          <Button variant="primary" size="md" leftIcon={<Copy size={14} />} onClick={handleCopy} isLoading={copyingTemplate}>
            Copy Template
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} size="md">
        <ModalHeader>
          <ModalTitle>Delete role template</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {deleteTarget?.assigned_user_count
              ? `This template is assigned to ${deleteTarget.assigned_user_count} users. Deletion will be blocked until those users are moved to another template.`
              : 'This action permanently removes the template. It cannot be undone.'}
          </div>
          {deleteTarget?.is_system ? (
            <p className="text-sm text-slate-500">System templates cannot be deleted.</p>
          ) : null}
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="md" onClick={() => setDeleteTarget(null)} disabled={deletingTemplate}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={handleDelete}
            isLoading={deletingTemplate}
            disabled={Boolean(deleteTarget?.is_system)}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
