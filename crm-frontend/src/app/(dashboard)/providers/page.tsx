'use client';

import { useState } from 'react';
import { Plus, User, Mail, Phone, Pencil, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProvidersList, useCreateProvider, useUpdateProvider, useProviderHistory } from '@/hooks/useProviders';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmChangeDialog, type FieldChange } from '@/components/ui/ConfirmChangeDialog';
import { ChangeHistoryPanel } from '@/components/ui/ChangeHistoryPanel';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Provider } from '@/types/appointment';

function ProviderHistoryRow({ providerId }: { providerId: string }) {
  const { data: history = [], isLoading } = useProviderHistory(providerId);
  return (
    <tr>
      <td colSpan={6} className="px-4 pb-4 bg-slate-50/70">
        <ChangeHistoryPanel history={history} isLoading={isLoading} />
      </td>
    </tr>
  );
}

function ProviderRow({ p }: { p: Provider }) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: update, isPending: saving } = useUpdateProvider();

  const startEdit = () => {
    setEditName(p.name);
    setEditEmail(p.email ?? '');
    setEditPhone(p.phone ?? '');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const requestSave = () => {
    const changes: FieldChange[] = [];
    if (editName !== p.name)
      changes.push({ field: 'name', label: 'Name', oldValue: p.name, newValue: editName });
    if (editEmail !== (p.email ?? ''))
      changes.push({ field: 'email', label: 'Email', oldValue: p.email, newValue: editEmail });
    if (editPhone !== (p.phone ?? ''))
      changes.push({ field: 'phone', label: 'Phone', oldValue: p.phone, newValue: editPhone });

    if (!changes.length) { setEditing(false); return; }
    setPendingChanges(changes);
    setShowConfirm(true);
  };

  const confirmSave = () => {
    const payload: any = {};
    pendingChanges.forEach((c) => { payload[c.field] = c.newValue; });
    update(
      { id: p.id, ...payload },
      {
        onSuccess: () => {
          toast.success('Provider updated');
          setShowConfirm(false);
          setEditing(false);
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.detail ?? 'Failed to update provider');
          setShowConfirm(false);
        },
      }
    );
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <Avatar name={p.name} size="sm" />
        </TableCell>
        <TableCell>
          {editing ? (
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-[160px]" />
          ) : (
            <span className="font-medium text-slate-900">{p.name}</span>
          )}
        </TableCell>
        <TableCell>
          {editing ? (
            <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="max-w-[200px]" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Mail size={14} className="text-slate-400" />
              {p.email ?? '—'}
            </div>
          )}
        </TableCell>
        <TableCell>
          {editing ? (
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="max-w-[140px]" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Phone size={14} className="text-slate-400" />
              {p.phone ?? '—'}
            </div>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={p.is_active ? 'success' : 'default'} size="sm" dot>
            {p.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        <TableCell align="right">
          <div className="flex items-center justify-end gap-1">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={cancelEdit}>Cancel</Button>
                <Button variant="primary" size="sm" leftIcon={<Check size={14} />} onClick={requestSave}>Save</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={startEdit} className="text-slate-400 hover:text-slate-700">Edit</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-slate-400 hover:text-slate-700"
                  title="Show history"
                >
                  {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update(
                      { id: p.id, is_active: !p.is_active },
                      { onSuccess: () => toast.success(`Provider ${p.is_active ? 'deactivated' : 'activated'}`) }
                    )
                  }
                  className={p.is_active ? 'text-slate-400 hover:text-error-600' : 'text-slate-400 hover:text-success-600'}
                >
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {showHistory && <ProviderHistoryRow providerId={p.id} />}

      <ConfirmChangeDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSave}
        isLoading={saving}
        title="Confirm Provider Changes"
        changes={pendingChanges}
      />
    </>
  );
}

export default function ProvidersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const { data: providers, isLoading } = useProvidersList(false);
  const { mutate: create, isPending: creating } = useCreateProvider();

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Providers</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage your clinic staff and providers</p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Plus size={18} />} onClick={() => setShowCreate(true)}>
          Add Provider
        </Button>
      </div>

      {showCreate && (
        <Card className="p-5" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle>Add New Provider</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Full Name *" value={newName} onChange={(e) => setNewName(e.target.value)} leftIcon={<User size={16} />} />
            <Input placeholder="Email (optional)" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} leftIcon={<Mail size={16} />} />
            <Input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} leftIcon={<Phone size={16} />} />
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
            <Button variant="primary" size="md" onClick={handleCreate} isLoading={creating}>
              {creating ? 'Creating...' : 'Add Provider'}
            </Button>
            <Button variant="outline" size="md" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

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
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">No providers found</h3>
            <p className="text-sm text-slate-500">Add your first provider to get started</p>
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
                <ProviderRow key={p.id} p={p} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
