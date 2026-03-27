'use client';

import { useState } from 'react';
import { Plus, User, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProvidersList, useCreateProvider, useUpdateProvider } from '@/hooks/useProviders';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ProvidersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const { data: providers, isLoading } = useProvidersList(false);
  const { mutate: create, isPending: creating } = useCreateProvider();
  const { mutate: update } = useUpdateProvider();

  const handleCreate = () => {
    if (!newName) return;
    create(
      { name: newName, email: newEmail || undefined, phone: newPhone || undefined },
      {
        onSuccess: () => {
          toast.success('Provider created successfully');
          setShowCreate(false);
          setNewName(''); setNewEmail(''); setNewPhone('');
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create provider'),
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Providers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your clinic staff and providers</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={18} />}
          onClick={() => setShowCreate(true)}
        >
          Add Provider
        </Button>
      </div>

      {/* Create Provider Form */}
      {showCreate && (
        <Card className="p-5" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle>Add New Provider</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Full Name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              leftIcon={<User size={16} />}
            />
            <Input
              placeholder="Email (optional)"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              leftIcon={<Mail size={16} />}
            />
            <Input
              placeholder="Phone (optional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              leftIcon={<Phone size={16} />}
            />
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              isLoading={creating}
            >
              {creating ? 'Creating...' : 'Add Provider'}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Providers Table */}
      <Card className="p-0 overflow-hidden" variant="elevated">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="w-40 h-4" />
                  <Skeleton variant="text" className="w-32 h-3" />
                </div>
                <Skeleton variant="text" className="w-24 h-4" />
                <Skeleton variant="text" className="w-20 h-4" />
              </div>
            ))}
          </div>
        ) : !providers?.length ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No providers found</h3>
            <p className="text-sm text-gray-500">Add your first provider to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead className="w-12"><span className="sr-only">Avatar</span></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Avatar name={p.name} size="sm" />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-900">{p.name}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail size={14} className="text-gray-400" />
                      {p.email ?? '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone size={14} className="text-gray-400" />
                      {p.phone ?? '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.is_active ? 'success' : 'default'}
                      size="sm"
                      dot
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update(
                          { id: p.id, is_active: !p.is_active },
                          {
                            onSuccess: () =>
                              toast.success(`Provider ${p.is_active ? 'deactivated' : 'activated'}`),
                          }
                        )
                      }
                      className={p.is_active ? 'text-gray-400 hover:text-error-600' : 'text-gray-400 hover:text-success-600'}
                    >
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
