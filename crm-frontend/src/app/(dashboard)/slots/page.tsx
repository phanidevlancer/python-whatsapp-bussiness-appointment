'use client';

import { useState } from 'react';
import { CalendarRange, Play, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useServicesList } from '@/hooks/useServices';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function SlotsPage() {
  const { data: services = [], isLoading: loadingServices } = useServicesList(false);

  const [serviceId, setServiceId] = useState('');
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(addDays(today(), 6));
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(18);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function handleGenerate() {
    if (!serviceId) {
      toast.error('Please select a service');
      return;
    }
    if (dateFrom > dateTo) {
      toast.error('Start date must be before end date');
      return;
    }
    if (startHour >= endHour) {
      toast.error('Start hour must be before end hour');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await api.post<{ created: number; skipped: number }>('/api/v1/slots/generate', {
        service_id: serviceId,
        date_from: dateFrom,
        date_to: dateTo,
        start_hour: startHour,
        end_hour: endHour,
        interval_minutes: intervalMinutes,
      });
      setResult(res.data);
      toast.success(`Generated ${res.data.created} slots`);
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
          ? (err as { response?: { data?: { detail?: string } } }).response!.data!.detail!
          : 'Failed to generate slots';
      toast.error(detail);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <CalendarRange size={24} style={{ color: 'var(--text-primary)' }} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Slot Management
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Generate availability slots for providers
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Slots</CardTitle>
        </CardHeader>
        <div className="p-6 space-y-5">
          {/* Service */}
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Service
            </label>
            {loadingServices ? (
              <div className="h-10 w-full animate-pulse rounded-xl" style={{ background: 'var(--input-background)' }} />
            ) : (
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{
                  background: 'var(--input-background)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">— Select a service —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.provider_count === 0 ? ' (no providers assigned)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                From date
              </label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                To date
              </label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {/* Hours */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Start hour (0–23)
              </label>
              <Input
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                End hour (0–23)
              </label>
              <Input
                type="number"
                min={1}
                max={24}
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Interval (minutes)
              </label>
              <Input
                type="number"
                min={5}
                max={240}
                step={5}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Info note */}
          <div
            className="flex items-start gap-2 rounded-xl p-3 text-sm"
            style={{ background: 'var(--panel-background)', border: '1px solid var(--panel-border)' }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>
              Slots are created per provider assigned to the selected service. Already existing slots are
              skipped automatically.
            </span>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2">
            <Play size={14} />
            {generating ? 'Generating…' : 'Generate Slots'}
          </Button>

          {result && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ background: 'var(--panel-background)', border: '1px solid var(--panel-border)' }}
            >
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Generation complete
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                <span className="font-medium text-emerald-500">{result.created}</span> slots created,{' '}
                <span className="font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {result.skipped}
                </span>{' '}
                already existed (skipped)
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
