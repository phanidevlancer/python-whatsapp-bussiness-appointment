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

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCustomersList({ search: search || undefined, page });

  return (
    <div className="space-y-5 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(240,249,255,0.62))] p-1">
      {/* Page Header */}
      <div className="flex items-center justify-between rounded-[24px] border border-white/70 bg-white/70 px-6 py-5 shadow-[0_16px_40px_rgba(13,148,136,0.08)] backdrop-blur-sm">
        <div>
          <h2 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-900">Customers</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage your customer relationships</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={18} />}
          className="h-11 rounded-2xl border border-primary-500/20 px-5 font-semibold shadow-[0_14px_28px_rgba(13,148,136,0.18)]"
        >
          Add Customer
        </Button>
      </div>

      {/* Search & Stats */}
      <Card className="rounded-[24px] border-white/80 bg-white/85 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm" variant="elevated">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftIcon={<Search size={16} />}
              className="h-12 w-full rounded-2xl border-0 bg-slate-100/80 shadow-none ring-1 ring-transparent focus:bg-white focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <Badge variant="primary" size="lg" className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">
            <Users size={16} />
            {data?.total ?? 0} customers
          </Badge>
        </div>
      </Card>

      {/* Table */}
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
                <Skeleton variant="text" className="w-48 h-4" />
                <Skeleton variant="text" className="w-24 h-4" />
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <Users size={32} className="text-primary-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">No customers found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableHeader className="border-b border-slate-100 bg-slate-50/80">
              <TableRow hoverable={false}>
                <TableHead className="w-12 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"><span className="sr-only">Avatar</span></TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Name</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Phone</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</TableHead>
                <TableHead className="py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {data.items.map((c) => (
                <TableRow key={c.id} className="group hover:bg-slate-50/80">
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
        <Card className="rounded-[24px] border-white/70 bg-white/75 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]" variant="default">
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
                className="rounded-2xl border-slate-200 bg-white px-4 text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / 20)}
                onClick={() => setPage(page + 1)}
                className="rounded-2xl border-slate-200 bg-white px-4 text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
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
