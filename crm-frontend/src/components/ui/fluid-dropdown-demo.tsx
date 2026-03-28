'use client';

import { useState } from 'react';
import type { AppointmentStatus } from '@/types/appointment';
import { Component } from '@/components/ui/fluid-dropdown';

export default function DemoOne() {
  const [status, setStatus] = useState<AppointmentStatus | undefined>();

  return <Component value={status} onChange={setStatus} />;
}
