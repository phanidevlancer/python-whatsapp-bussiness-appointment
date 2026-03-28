'use client';

import { useState } from 'react';
import { DropdownRangeDatePicker } from '@/components/ui/dropdown-range-date-picker';

export default function DropdownRangeDatePickerDemoPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});

  return (
    <div className="flex min-h-screen items-center justify-center">
      <DropdownRangeDatePicker value={range} onApply={setRange} />
    </div>
  );
}
