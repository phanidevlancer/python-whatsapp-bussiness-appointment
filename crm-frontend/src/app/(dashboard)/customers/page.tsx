'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { useCustomersList } from '@/hooks/useCustomers';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCustomersList({ search: search || undefined, page });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <span className="text-sm text-gray-400 ml-auto">{data?.total ?? 0} customers</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Name</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Phone</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Email</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : !data?.items.length ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">No customers found</td></tr>
            ) : data.items.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="py-3 px-4">
                  <Link href={`/customers/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                    {c.name ?? '—'}
                  </Link>
                </td>
                <td className="py-3 px-4 text-gray-600">{c.phone}</td>
                <td className="py-3 px-4 text-gray-600">{c.email ?? '—'}</td>
                <td className="py-3 px-4 text-gray-400 text-xs">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
