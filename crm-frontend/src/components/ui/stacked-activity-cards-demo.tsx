'use client';

import { Mountain, Waves, Wine } from 'lucide-react';
import { StackedActivityCards } from '@/components/ui/stacked-activity-cards';

const demoItems = [
  {
    id: 1,
    activity: 'Mountain Hiking',
    location: 'Mount Rainier',
    date: '12 August',
    color: '#ff7e5f',
    icon: Mountain,
  },
  {
    id: 2,
    activity: 'Surfing Lesson',
    location: 'Malibu Beach',
    date: '8 August',
    color: '#0396FF',
    icon: Waves,
  },
  {
    id: 3,
    activity: 'Wine Tasting',
    location: 'Napa Valley',
    date: '30 July',
    color: '#7367F0',
    icon: Wine,
  },
];

export default function StackedActivityCardsDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_40%,#eef2ff_100%)] p-6">
      <StackedActivityCards items={demoItems} />
    </div>
  );
}
