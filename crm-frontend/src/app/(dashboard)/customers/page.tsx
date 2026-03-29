'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Search, Users, Plus } from 'lucide-react';
import { useCustomersList } from '@/hooks/useCustomers';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCustomersList({ search: search || undefined, page });

  return (
    <div className="dashboard-page-shell space-y-5">
      {/* Page Header */}
      <div className="dashboard-page-header flex items-center justify-between rounded-[24px] px-6 py-5">
        <div>
          <h2 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">Patients</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage your patient relationships</p>
        </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={18} />}
            className="h-11 rounded-2xl border border-primary-500/20 px-5 font-semibold shadow-[0_14px_28px_rgba(13,148,136,0.18)]"
          >
            Add Patient
          </Button>
      </div>

      {/* Search & Stats */}
      <Card className="dashboard-page-panel rounded-[24px] p-5" variant="elevated">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftIcon={<Search size={16} />}
              className="dashboard-surface-input h-12 w-full rounded-2xl border shadow-none ring-1 ring-transparent focus:ring-2 focus:ring-primary-200"
            />
          </div>
            <Badge variant="primary" size="lg" className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">
              <Users size={16} />
              {data?.total ?? 0} patients
            </Badge>
        </div>
      </Card>

      {/* Table */}
      <Card className="dashboard-page-panel overflow-hidden rounded-[28px] p-0" variant="elevated">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="w-40 h-4" />
                  <Skeleton variant="text" className="w-32 h-3" />
                </div>
                <Skeleton variant="text" className="w-48 h-4" />
                <Skeleton variant="text" className="w-24 h-4" />
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="py-20 text-center">
            <div className="dashboard-empty-state-icon mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <Users size={32} className="text-primary-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">No patients found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableHeader className="dashboard-page-table-head border-b">
              <TableRow hoverable={false}>
                <TableHead className="w-12 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"><span className="sr-only">Avatar</span></TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Name</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Phone</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Since</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {data.items.map((c) => (
                <TableRow key={c.id} className="group">
                  <TableCell className="py-4">
                    <Avatar name={c.name ?? c.phone} size="sm" />
                  </TableCell>
                  <TableCell className="py-4">
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-semibold text-slate-900 transition-colors hover:text-primary-600"
                    >
                      {c.name ?? '—'}
                    </Link>
                    {c.name && (
                      <p className="text-xs text-slate-500">{c.phone}</p>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-sm text-slate-700">{c.phone}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="text-sm text-slate-700">{c.email ?? '—'}</span>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                      <span className="text-sm text-slate-700">
                        {format(new Date(c.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > 20 && (
        <Card className="dashboard-page-panel rounded-[24px] p-4" variant="default">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
              <span className="font-semibold text-slate-900">{Math.ceil(data.total / 20)}</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="dashboard-action-outline rounded-2xl border px-4"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / 20)}
                onClick={() => setPage(page + 1)}
                className="dashboard-action-outline rounded-2xl border px-4"
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
