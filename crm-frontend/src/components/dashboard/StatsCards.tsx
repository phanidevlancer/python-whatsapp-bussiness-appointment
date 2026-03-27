import { Calendar, CheckCircle, XCircle, Users, Activity, TrendingUp, Clock } from 'lucide-react';
import type { DashboardStats } from '@/types/dashboard';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  trend?: number;
}

function StatCard({ label, value, icon, color, bgColor, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${bgColor}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1">
            <TrendingUp size={14} className={trend >= 0 ? 'text-green-600' : 'text-red-600'} />
            <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function StatsCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        label="Today"
        value={stats.total_appointments_today}
        icon={<Calendar size={20} className="text-blue-600" />}
        bgColor="bg-blue-50"
        color="text-blue-600"
        trend={12}
      />
      <StatCard
        label="This Week"
        value={stats.total_appointments_week}
        icon={<Activity size={20} className="text-purple-600" />}
        bgColor="bg-purple-50"
        color="text-purple-600"
        trend={8}
      />
      <StatCard
        label="Confirmed"
        value={stats.total_confirmed}
        icon={<CheckCircle size={20} className="text-green-600" />}
        bgColor="bg-green-50"
        color="text-green-600"
        trend={5}
      />
      <StatCard
        label="Cancelled"
        value={stats.total_cancelled}
        icon={<XCircle size={20} className="text-red-600" />}
        bgColor="bg-red-50"
        color="text-red-600"
        trend={-3}
      />
      <StatCard
        label="Completed"
        value={stats.total_completed}
        icon={<CheckCircle size={20} className="text-teal-600" />}
        bgColor="bg-teal-50"
        color="text-teal-600"
        trend={15}
      />
      <StatCard
        label="Total Contacts"
        value={stats.total_customers}
        icon={<Users size={20} className="text-orange-600" />}
        bgColor="bg-orange-50"
        color="text-orange-600"
        trend={22}
      />
    </div>
  );
}
