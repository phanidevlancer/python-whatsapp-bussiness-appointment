import logging
from datetime import datetime, timezone, timedelta, date

from sqlalchemy import func, select, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment, AppointmentStatus
from app.models.customer import Customer
from app.models.provider import Provider
from app.models.service import Service
from app.models.time_slot import TimeSlot
from app.schemas.dashboard import DashboardStats, TrendDataPoint, TrendResponse, UpcomingAppointment

logger = logging.getLogger(__name__)


async def get_stats(db: AsyncSession) -> DashboardStats:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Appointment aggregates in one query
    appt_result = await db.execute(
        select(
            func.count(Appointment.id).label("total"),
            func.count(
                case((Appointment.created_at >= today_start, Appointment.id))
            ).label("today"),
            func.count(
                case((Appointment.created_at >= week_start, Appointment.id))
            ).label("week"),
            func.count(
                case((Appointment.status == AppointmentStatus.CONFIRMED, Appointment.id))
            ).label("confirmed"),
            func.count(
                case((Appointment.status == AppointmentStatus.CANCELLED, Appointment.id))
            ).label("cancelled"),
            func.count(
                case((Appointment.status == AppointmentStatus.COMPLETED, Appointment.id))
            ).label("completed"),
            func.count(
                case((Appointment.status == AppointmentStatus.NO_SHOW, Appointment.id))
            ).label("no_show"),
        )
    )
    row = appt_result.one()

    total_customers = (await db.execute(select(func.count(Customer.id)))).scalar_one()
    total_services = (
        await db.execute(select(func.count(Service.id)).where(Service.is_active == True))
    ).scalar_one()
    total_providers = (
        await db.execute(select(func.count(Provider.id)).where(Provider.is_active == True))
    ).scalar_one()

    return DashboardStats(
        total_appointments_today=row.today,
        total_appointments_week=row.week,
        total_confirmed=row.confirmed,
        total_cancelled=row.cancelled,
        total_completed=row.completed,
        total_no_show=row.no_show,
        total_customers=total_customers,
        total_active_services=total_services,
        total_active_providers=total_providers,
    )


async def get_trends(db: AsyncSession, range_str: str = "7d") -> TrendResponse:
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(range_str, 7)

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(TimeSlot.start_time).label("slot_date"),
            Appointment.status,
            func.count(Appointment.id).label("cnt"),
        )
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .where(TimeSlot.start_time >= start)
        .group_by(func.date(TimeSlot.start_time), Appointment.status)
        .order_by(func.date(TimeSlot.start_time))
    )
    rows = result.all()

    # Build date → counts map
    data_map: dict[str, dict] = {}
    for row in rows:
        d = str(row.slot_date)
        if d not in data_map:
            data_map[d] = {"confirmed": 0, "cancelled": 0, "completed": 0, "no_show": 0}
        status_key = row.status.value if hasattr(row.status, "value") else str(row.status)
        if status_key in data_map[d]:
            data_map[d][status_key] = row.cnt

    # Fill gaps for dates with no data
    trend_data = []
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        counts = data_map.get(d, {"confirmed": 0, "cancelled": 0, "completed": 0, "no_show": 0})
        trend_data.append(TrendDataPoint(date=d, **counts))

    return TrendResponse(range=range_str, data=trend_data)


async def get_upcoming_appointments(db: AsyncSession, limit: int = 10) -> list[UpcomingAppointment]:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(
            Appointment.id,
            Appointment.user_phone,
            Appointment.status,
            Service.name.label("service_name"),
            TimeSlot.start_time,
            Provider.name.label("provider_name"),
        )
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .join(Service, Appointment.service_id == Service.id)
        .outerjoin(Provider, Appointment.provider_id == Provider.id)
        .where(
            Appointment.status == AppointmentStatus.CONFIRMED,
            TimeSlot.start_time > now,
        )
        .order_by(TimeSlot.start_time)
        .limit(limit)
    )
    rows = result.all()
    return [
        UpcomingAppointment(
            id=r.id,
            user_phone=r.user_phone,
            service_name=r.service_name,
            start_time=r.start_time,
            status=r.status.value if hasattr(r.status, "value") else str(r.status),
            provider_name=r.provider_name,
        )
        for r in rows
    ]
