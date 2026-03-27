import uuid
from datetime import datetime
from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_appointments_today: int
    total_appointments_week: int
    total_confirmed: int
    total_cancelled: int
    total_completed: int
    total_no_show: int
    total_customers: int
    total_active_services: int
    total_active_providers: int


class ChannelStats(BaseModel):
    channel: str
    total_appointments: int
    confirmed: int
    cancelled: int
    completed: int
    no_show: int
    conversion_rate: float


class ChannelCancellationStats(BaseModel):
    channel: str
    cancellations: int
    percentage: float


class TrendDataPoint(BaseModel):
    date: str
    confirmed: int
    cancelled: int
    completed: int
    no_show: int


class TrendResponse(BaseModel):
    range: str
    data: list[TrendDataPoint]


class UpcomingAppointment(BaseModel):
    id: uuid.UUID
    user_phone: str
    service_name: str
    start_time: datetime
    status: str
    provider_name: str | None
