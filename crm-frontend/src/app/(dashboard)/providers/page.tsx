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

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: { data?: unknown } }).response?.data &&
    typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
  ) {
    return (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? fallback;
  }

  return fallback;
}

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
    const payload: { name?: string; email?: string; phone?: string } = {};
    pendingChanges.forEach((c) => {
      if (c.field === 'name') payload.name = c.newValue ?? '';
      if (c.field === 'email') payload.email = c.newValue || undefined;
      if (c.field === 'phone') payload.phone = c.newValue || undefined;
    });
    update(
      { id: p.id, ...payload },
      {
        onSuccess: () => {
          toast.success('Provider updated');
          setShowConfirm(false);
          setEditing(false);
        },
        onError: (err: unknown) => {
          toast.error(getErrorMessage(err, 'Failed to update provider'));
          setShowConfirm(false);
        },
      }
    );
  };

  return (
    <>
      <TableRow className="group hover:bg-slate-50/80">
        <TableCell className="py-4">
          <Avatar name={p.name} size="sm" />
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-[160px] rounded-2xl border-0 bg-slate-100/80 shadow-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-primary-200" />
          ) : (
            <span className="font-semibold text-slate-900">{p.name}</span>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="max-w-[200px] rounded-2xl border-0 bg-slate-100/80 shadow-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-primary-200" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Mail size={14} className="text-slate-400" />
              {p.email ?? '—'}
            </div>
          )}
        </TableCell>
        <TableCell className="py-4">
          {editing ? (
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="max-w-[140px] rounded-2xl border-0 bg-slate-100/80 shadow-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-primary-200" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Phone size={14} className="text-slate-400" />
              {p.phone ?? '—'}
            </div>
          )}
        </TableCell>
        <TableCell className="py-4">
          <Badge variant={p.is_active ? 'success' : 'default'} size="sm" dot className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            {p.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        <TableCell align="right" className="py-4">
          <div className="flex items-center justify-end gap-1">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={cancelEdit} className="rounded-2xl px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-800">Cancel</Button>
                <Button variant="primary" size="sm" leftIcon={<Check size={14} />} onClick={requestSave} className="rounded-2xl px-3">Save</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />} onClick={startEdit} className="rounded-2xl px-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700">Edit</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory((v) => !v)}
                  className="rounded-2xl px-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                  className={p.is_active ? 'rounded-2xl px-3 text-slate-400 hover:bg-red-50 hover:text-error-600' : 'rounded-2xl px-3 text-slate-400 hover:bg-emerald-50 hover:text-success-600'}
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
        onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to create provider')),
      }
    );
  };

  return (
    <div className="space-y-5 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(240,249,255,0.62))] p-1">
      <div className="flex items-center justify-between rounded-[24px] border border-white/70 bg-white/70 px-6 py-5 shadow-[0_16px_40px_rgba(13,148,136,0.08)] backdrop-blur-sm">
        <div>
          <h2 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">Providers</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage your clinic staff and providers</p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Plus size={18} />} onClick={() => setShowCreate(true)} className="h-11 rounded-2xl border border-primary-500/20 px-5 font-semibold shadow-[0_14px_28px_rgba(13,148,136,0.18)]">
          Add Provider
        </Button>
      </div>

      {showCreate && (
        <Card className="rounded-[24px] border-white/80 bg-white/85 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm" variant="elevated">
          <CardHeader className="pb-4 border-0">
            <CardTitle className="text-lg font-bold tracking-[-0.02em] text-slate-900">Add New Provider</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Full Name *" value={newName} onChange={(e) => setNewName(e.target.value)} leftIcon={<User size={16} />} className="h-12 rounded-2xl border-0 bg-slate-100/80 shadow-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-primary-200" />
            <Input placeholder="Email (optional)" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} leftIcon={<Mail size={16} />} className="h-12 rounded-2xl border-0 bg-slate-100/80 shadow-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-primary-200" />
            <Input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} leftIcon={<Phone size={16} />} className="h-12 rounded-2xl border-0 bg-slate-100/80 shadow-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-primary-200" />
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
            <Button variant="primary" size="md" onClick={handleCreate} isLoading={creating} className="rounded-2xl px-5 shadow-[0_14px_28px_rgba(13,148,136,0.18)]">
              {creating ? 'Creating...' : 'Add Provider'}
            </Button>
            <Button variant="outline" size="md" onClick={() => setShowCreate(false)} className="rounded-2xl border-slate-200 bg-white px-5 text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700">Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden rounded-[28px] border-white/80 bg-white/90 p-0 shadow-[0_20px_48px_rgba(15,23,42,0.08)]" variant="elevated">
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
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <User size={32} className="text-primary-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">No providers found</h3>
            <p className="text-sm text-slate-500">Add your first provider to get started</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableHeader className="border-b border-slate-100 bg-slate-50/80">
              <TableRow hoverable={false}>
                <TableHead className="w-12 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"><span className="sr-only">Avatar</span></TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Name</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Phone</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
                <TableHead align="right" className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
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
