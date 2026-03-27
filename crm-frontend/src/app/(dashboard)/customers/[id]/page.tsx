'use client';

import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useCustomerDetail, useCustomerAppointments } from '@/hooks/useCustomers';
import StatusBadge from '@/components/appointments/StatusBadge';
import Link from 'next/link';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomerDetail(id);
  const { data: appts } = useCustomerAppointments(id);

  if (isLoading) return <div className="text-gray-400 text-sm p-8 text-center">Loading…</div>;
  if (!customer) return <div className="text-gray-400 text-sm p-8 text-center">Not found</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">{customer.name ?? 'Unknown'}</h2>
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Phone</p>
            <p className="font-medium">{customer.phone}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Email</p>
            <p className="font-medium">{customer.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Customer since</p>
            <p className="font-medium">{format(new Date(customer.created_at), 'MMM d, yyyy')}</p>
          </div>
          {customer.notes && (
            <div>
              <p className="text-gray-400 text-xs">Notes</p>
              <p className="font-medium">{customer.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Appointment History ({appts?.total ?? 0})</h3>
        {!appts?.items.length ? (
          <p className="text-sm text-gray-400">No appointments</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {appts.items.map((a) => (
              <Link key={a.id} href={`/appointments/${a.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.service?.name ?? '—'}</p>
                  <p className="text-xs text-gray-400">
                    {a.slot ? format(new Date(a.slot.start_time), 'MMM d, h:mm a') : '—'}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
