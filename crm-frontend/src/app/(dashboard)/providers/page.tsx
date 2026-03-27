'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProvidersList, useCreateProvider, useUpdateProvider } from '@/hooks/useProviders';

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
          toast.success('Provider created');
          setShowCreate(false);
          setNewName(''); setNewEmail(''); setNewPhone('');
        },
        onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={14} /> Add Provider
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Add Provider</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
              {creating ? 'Creating…' : 'Add'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Name</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Email</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Phone</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : providers?.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{p.name}</td>
                <td className="py-3 px-4 text-gray-500">{p.email ?? '—'}</td>
                <td className="py-3 px-4 text-gray-500">{p.phone ?? '—'}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => update(
                      { id: p.id, is_active: !p.is_active },
                      { onSuccess: () => toast.success(`Provider ${p.is_active ? 'deactivated' : 'activated'}`) }
                    )}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
