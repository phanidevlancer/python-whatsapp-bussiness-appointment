'use client';

import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useAppointmentsList } from '@/hooks/useAppointments';
import AppointmentsTable from '@/components/appointments/AppointmentsTable';
import CreateAppointmentDialog from '@/components/appointments/CreateAppointmentDialog';
import type { AppointmentFilters, AppointmentStatus } from '@/types/appointment';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { FluidDropdown } from '@/components/ui/fluid-dropdown';
import { DropdownRangeDatePicker } from '@/components/ui/dropdown-range-date-picker';

export default function AppointmentsPage() {
  const [filters, setFilters] = useState<AppointmentFilters>({ page: 1, page_size: 20 });
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading } = useAppointmentsList({ ...filters, search: search || undefined });

  const setFilter = (key: keyof AppointmentFilters, value: string | AppointmentStatus | undefined) =>
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }));

  const hasActiveFilters = search || filters.status || filters.date_from || filters.date_to;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Appointments</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage and track all clinic appointments</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={18} />}
          onClick={() => setShowCreateDialog(true)}
        >
          New Appointment
        </Button>
      </div>

      {/* Filters Card */}
      <Card className="relative z-20 p-4" variant="elevated">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={16} />}
              className="w-full"
            />
          </div>

          {/* Status Filter */}
          <FluidDropdown
            value={filters.status}
            onChange={(value) => setFilter('status', value)}
            className="w-full md:w-44"
          />

          {/* Date Range */}
          <DropdownRangeDatePicker
            value={{ from: filters.date_from, to: filters.date_to }}
            onApply={({ from, to }) =>
              setFilters((current) => ({
                ...current,
                date_from: from,
                date_to: to,
                page: 1,
              }))
            }
            className="w-full md:w-[280px] justify-start text-left font-normal"
          />

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilters({ page: 1, page_size: 20 }); setSearch(''); }}
            >
              Clear filters
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="primary" size="md">
              {data?.total ?? 0} results
            </Badge>
          </div>
        </div>
      </Card>

      {/* Table Card */}
      <Card className="relative z-0 overflow-hidden p-0" variant="elevated">
        <AppointmentsTable appointments={data?.items ?? []} isLoading={isLoading} />
      </Card>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <Card className="p-4" variant="default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-900">{((filters.page ?? 1) - 1) * (filters.page_size ?? 20) + 1}</span> to{' '}
                <span className="font-medium text-slate-900">{Math.min((filters.page ?? 1) * (filters.page_size ?? 20), data.total)}</span> of{' '}
                <span className="font-medium text-slate-900">{data.total}</span> results
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) >= Math.ceil(data.total / data.page_size)}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
