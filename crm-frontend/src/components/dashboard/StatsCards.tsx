'use client';

import { Calendar, CheckCircle, CircleCheck, Ban, Users, TrendingUp, TrendingDown } from 'lucide-react';
import type { DashboardStats } from '@/types/dashboard';

interface SparklineProps {
  data: number[];
  color: string;
}

function Sparkline({ data, color }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 40;
  const padX = 2;
  const padY = 4;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + (1 - (v - min) / range) * chartH;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  trend?: number;
  sparkData: number[];
  sparkColor: string;
}

function StatCard({ label, value, icon, iconBg, trend, sparkData, sparkColor }: StatCardProps) {
  const trendUp = trend !== undefined && trend >= 0;
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-slate-100 relative overflow-hidden flex flex-col justify-between h-28">
      <div className="flex justify-between items-start">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center px-1.5 py-0.5 rounded ${trendUp ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
            {trendUp ? <TrendingUp size={11} className="mr-1" /> : <TrendingDown size={11} className="mr-1" />}
            {trendUp ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="mt-2 flex justify-between items-end relative z-10">
        <div>
          <h3 className="text-2xl font-bold text-slate-800 leading-none mb-1">{value}</h3>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
        <div className="w-20 h-10 opacity-70">
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      </div>
    </div>
  );
}

export default function StatsCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <StatCard
        label="Today"
        value={stats.total_appointments_today}
        icon={<Calendar size={16} className="text-blue-500" />}
        iconBg="bg-blue-50"
        trend={12}
        sparkData={[10, 15, 12, 20, 18, 25]}
        sparkColor="#10b981"
      />
      <StatCard
        label="This Week"
        value={stats.total_appointments_week}
        icon={<TrendingUp size={16} className="text-purple-500" />}
        iconBg="bg-purple-50"
        trend={5}
        sparkData={[5, 10, 8, 15, 12, 20]}
        sparkColor="#8b5cf6"
      />
      <StatCard
        label="Confirmed"
        value={stats.total_confirmed}
        icon={<CheckCircle size={16} className="text-emerald-500" />}
        iconBg="bg-emerald-50"
        trend={6}
        sparkData={[2, 5, 4, 8, 6, 10]}
        sparkColor="#10b981"
      />
      <StatCard
        label="Cancelled"
        value={stats.total_cancelled}
        icon={<Ban size={16} className="text-red-500" />}
        iconBg="bg-red-50"
        trend={-3}
        sparkData={[8, 5, 7, 3, 4, 2]}
        sparkColor="#ef4444"
      />
      <StatCard
        label="Completed"
        value={stats.total_completed}
        icon={<CircleCheck size={16} className="text-teal-500" />}
        iconBg="bg-teal-50"
        trend={15}
        sparkData={[3, 6, 5, 9, 8, 12]}
        sparkColor="#14b8a6"
      />
      <StatCard
        label="Total Contacts"
        value={stats.total_customers}
        icon={<Users size={16} className="text-orange-500" />}
        iconBg="bg-orange-50"
        trend={-2}
        sparkData={[12, 10, 15, 8, 12, 9]}
        sparkColor="#f97316"
      />
    </div>
  );
}
