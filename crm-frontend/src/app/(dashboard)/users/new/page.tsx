'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, ShieldX, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useCreateUser } from '@/hooks/useUsers';
import { usePermission } from '@/hooks/usePermission';
import PermissionGuard from '@/components/auth/PermissionGuard';
import { Card, CardHeader, CardTitle, CardSubtitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PERMISSIONS } from '@/lib/permissions';

interface RoleTemplateOption {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  assigned_user_count?: number;
}

export default function NewUserPage() {
  const router = useRouter();
  const { mutateAsync: createUser, isPending } = useCreateUser();
  const canCreateUsers = usePermission(PERMISSIONS.users.create);
  const { data: templates } = useQuery({
    queryKey: ['role-templates', 'users-create'],
    queryFn: async () => {
      const res = await api.get<RoleTemplateOption[]>('/api/v1/role-templates');
      return res.data;
    },
    enabled: canCreateUsers,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const activeTemplates = (templates ?? []).filter((template) => template.is_active);

  if (!canCreateUsers) {
    return (
      <Card className="p-8 text-center" variant="elevated">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <ShieldX size={28} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Access denied</h2>
        <p className="mt-1 text-sm text-slate-500">
          You do not have permission to create users.
        </p>
      </Card>
    );
  }

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setFormError('Name, email, and password are required.');
      return;
    }

    try {
      const user = await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,
        employee_code: employeeCode.trim() || null,
        template_id: templateId || null,
        must_change_password: mustChangePassword,
      });
      toast.success('User created');
      router.replace(`/users/${user.id}`);
    } catch (error) {
      const detail =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'detail' in error.response.data &&
        typeof error.response.data.detail === 'string'
          ? error.response.data.detail
          : 'Failed to create user';
      toast.error(detail);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <Card className="overflow-hidden" variant="elevated">
        <CardHeader>
          <div>
            <CardTitle>Create User</CardTitle>
            <CardSubtitle>Set up a staff account and optionally assign a role template.</CardSubtitle>
          </div>
          <Badge variant="primary" size="lg">
            <BadgeCheck size={16} />
            Staff onboarding
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Temporary Password *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} helperText="Must meet the password policy." />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Employee Code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Role Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No template assigned</option>
                {activeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={mustChangePassword}
              onChange={(e) => setMustChangePassword(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Force password change on first login
          </label>
          {formError ? <p className="text-sm font-medium text-error-600">{formError}</p> : null}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" size="md" onClick={() => router.back()} disabled={isPending}>
              Cancel
            </Button>
            <PermissionGuard permission={PERMISSIONS.users.create}>
              <Button variant="primary" size="md" leftIcon={<UserPlus size={16} />} onClick={handleCreate} isLoading={isPending}>
                Create User
              </Button>
            </PermissionGuard>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
