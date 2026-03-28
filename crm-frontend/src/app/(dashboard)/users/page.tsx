'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Search, UserPlus, Users, ShieldX } from 'lucide-react';
import { useUsersList } from '@/hooks/useUsers';
import { usePermission } from '@/hooks/usePermission';
import PermissionGuard from '@/components/auth/PermissionGuard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PERMISSIONS } from '@/lib/permissions';

export default function UsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const canViewUsers = usePermission(PERMISSIONS.users.view);
  const { data, isLoading } = useUsersList(
    { search: search || undefined, page, page_size: 20 },
    { enabled: canViewUsers }
  );

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage clinic staff, templates, and access.</p>
        </div>
        <Badge variant="primary" size="lg">
          <Users size={16} />
          {data?.total ?? 0} users
        </Badge>
      </div>

      <Card className="p-4" variant="elevated">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              placeholder="Search by name, email, phone, or employee code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search size={16} />}
            />
          </div>
          <PermissionGuard permission={PERMISSIONS.users.create}>
            <Button
              variant="outline"
              size="md"
              leftIcon={<UserPlus size={16} />}
              onClick={() => router.push('/users/new')}
            >
              Add User
            </Button>
          </PermissionGuard>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden" variant="elevated">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="w-40 h-4" />
                  <Skeleton variant="text" className="w-56 h-3" />
                </div>
                <Skeleton variant="text" className="w-24 h-4" />
                <Skeleton variant="text" className="w-24 h-4" />
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">No users found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Template</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="sm" />
                        <div>
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">
                            {user.employee_code ?? 'No employee code'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div>{user.email}</div>
                      <div className="text-xs text-slate-500">{user.phone ?? 'No phone'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-700">{user.template_name ?? 'Unassigned'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={user.is_active ? 'success' : 'error'} size="sm" dot>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/users/${user.id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.total > data.page_size && (
        <Card className="p-4" variant="default">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              Page <span className="font-medium text-slate-900">{page}</span> of{' '}
              <span className="font-medium text-slate-900">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
