export interface DashboardStats {
  total_appointments_today: number;
  total_appointments_week: number;
  total_confirmed: number;
  total_cancelled: number;
  total_completed: number;
  total_no_show: number;
  total_customers: number;
  total_active_services: number;
  total_active_providers: number;
}

export interface TrendDataPoint {
  date: string;
  confirmed: number;
  cancelled: number;
  completed: number;
  no_show: number;
}

export interface TrendResponse {
  range: string;
  data: TrendDataPoint[];
}

export interface UpcomingAppointment {
  id: string;
  user_phone: string;
  service_name: string;
  start_time: string;
  status: string;
  provider_name: string | null;
}
