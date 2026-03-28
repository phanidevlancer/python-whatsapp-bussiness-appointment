'use client';

import React from 'react';
import { DeliveryScheduler } from '@/components/ui/delivery-scheduler';

export default function DeliverySchedulerDemo() {
  const availableTimes = ['4:30 AM', '5:00 AM', '5:30 AM', '6:00 AM', '6:30 AM', '7:00 AM'];

  const handleSchedule = (dateTime: { date: Date; time: string }) => {
    alert(`Scheduled!\n\nDate: ${dateTime.date.toLocaleDateString()}\nTime: ${dateTime.time}`);
  };

  return (
    <div className="flex min-h-[500px] w-full items-center justify-center bg-background p-4">
      <DeliveryScheduler
        timeSlots={availableTimes}
        timeZone="Lisbon (GMT +1)"
        onSchedule={handleSchedule}
        initialDate={new Date('2025-05-05')}
      />
    </div>
  );
}
