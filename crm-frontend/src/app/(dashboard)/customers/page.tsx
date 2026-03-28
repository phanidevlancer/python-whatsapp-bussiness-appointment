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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customers</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage your customer relationships</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={18} />}
        >
          Add Customer
        </Button>
      </div>

      {/* Search & Stats */}
      <Card className="p-4" variant="elevated">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftIcon={<Search size={16} />}
              className="w-full"
            />
          </div>
          <Badge variant="primary" size="lg">
            <Users size={16} />
            {data?.total ?? 0} customers
          </Badge>
        </div>
      </Card>

      {/* Table */}
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
                <Skeleton variant="text" className="w-48 h-4" />
                <Skeleton variant="text" className="w-24 h-4" />
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-1">No customers found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead className="w-12"><span className="sr-only">Avatar</span></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Avatar name={c.name ?? c.phone} size="sm" />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-slate-900 hover:text-primary-600 transition-colors"
                    >
                      {c.name ?? '—'}
                    </Link>
                    {c.name && (
                      <p className="text-xs text-slate-500">{c.phone}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-700">{c.phone}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-700">{c.email ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
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
        <Card className="p-4" variant="default">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page <span className="font-medium text-slate-900">{page}</span> of{' '}
              <span className="font-medium text-slate-900">{Math.ceil(data.total / 20)}</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / 20)}
                onClick={() => setPage(page + 1)}
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
