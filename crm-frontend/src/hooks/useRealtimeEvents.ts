'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export function useRealtimeEvents() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;

    const url = `${API_BASE}/api/v1/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener('appointment_created', () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    });

    es.addEventListener('appointment_updated', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['appointment', data.appointment_id] });
      qc.invalidateQueries({ queryKey: ['appointment', data.appointment_id, 'history'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    });

    es.onerror = () => {
      // Browser auto-reconnects on error — no action needed
    };

    return () => es.close();
  }, [token, qc]);
}
