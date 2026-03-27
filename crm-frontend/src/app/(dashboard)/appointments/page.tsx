'use client';

import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useAppointmentsList } from '@/hooks/useAppointments';
import AppointmentsTable from '@/components/appointments/AppointmentsTable';
import type { AppointmentFilters, AppointmentStatus } from '@/types/appointment';

export default function AppointmentsPage() {
  const [filters, setFilters] = useState<AppointmentFilters>({ page: 1, page_size: 20 });
  const [search, setSearch] = useState('');

  const { data, isLoading } = useAppointmentsList({ ...filters, search: search || undefined });

  const setFilter = (key: keyof AppointmentFilters, value: any) =>
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.status ?? ''}
          onChange={(e) => setFilter('status', e.target.value as AppointmentStatus)}
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="no_show">No Show</option>
        </select>
        <input
          type="date"
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.date_from ?? ''}
          onChange={(e) => setFilter('date_from', e.target.value)}
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.date_to ?? ''}
          onChange={(e) => setFilter('date_to', e.target.value)}
        />
        <button
          onClick={() => { setFilters({ page: 1, page_size: 20 }); setSearch(''); }}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Clear
        </button>
        <div className="ml-auto text-sm text-gray-400">
          {data?.total ?? 0} results
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <AppointmentsTable appointments={data?.items ?? []} isLoading={isLoading} />
      </div>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {data.page} of {Math.ceil(data.total / data.page_size)}
          </span>
          <div className="flex gap-2">
            <button
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={(filters.page ?? 1) >= Math.ceil(data.total / data.page_size)}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
