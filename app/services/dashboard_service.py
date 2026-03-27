import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus, AppointmentSource
from app.models.customer import Customer
from app.models.provider import Provider
from app.models.service import Service
from app.models.time_slot import TimeSlot
from app.schemas.dashboard import (
    DashboardStats,
    TrendDataPoint,
    TrendResponse,
    UpcomingAppointment,
    ChannelStats,
    ChannelCancellationStats,
    ChannelRescheduleStats,
)

logger = logging.getLogger(__name__)


async def get_stats(db: AsyncSession) -> DashboardStats:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Get all appointments and count in Python to avoid enum issues
    result = await db.execute(
        select(Appointment).where(
            Appointment.created_at >= week_start
        )
    )
    recent_appointments = result.scalars().all()
    
    # Count by status
    status_counts = {
        'confirmed': 0,
        'cancelled': 0,
        'completed': 0,
        'no_show': 0,
    }
    
    today_count = 0
    week_count = len(recent_appointments)
    
    for appt in recent_appointments:
        # Count today
        if appt.created_at >= today_start:
            today_count += 1
        
        # Count by status
        status_value = appt.status.value if hasattr(appt.status, 'value') else str(appt.status)
        if status_value in status_counts:
            status_counts[status_value] += 1

    # Get total counts
    total_customers_result = await db.execute(select(func.count(Customer.id)))
    total_customers = total_customers_result.scalar_one() or 0
    
    total_services_result = await db.execute(
        select(func.count(Service.id)).where(Service.is_active == True)
    )
    total_services = total_services_result.scalar_one() or 0
    
    total_providers_result = await db.execute(
        select(func.count(Provider.id)).where(Provider.is_active == True)
    )
    total_providers = total_providers_result.scalar_one() or 0

    logger.info(f"Stats: today={today_count}, week={week_count}, confirmed={status_counts['confirmed']}, cancelled={status_counts['cancelled']}, completed={status_counts['completed']}")

    return DashboardStats(
        total_appointments_today=today_count,
        total_appointments_week=week_count,
        total_confirmed=status_counts['confirmed'],
        total_cancelled=status_counts['cancelled'],
        total_completed=status_counts['completed'],
        total_no_show=status_counts['no_show'],
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
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id, isouter=True)
        .where(TimeSlot.start_time >= start)
        .group_by(func.date(TimeSlot.start_time), Appointment.status)
        .order_by(func.date(TimeSlot.start_time))
    )
    rows = result.all()

    # Build date → counts map
    data_map: dict[str, dict] = {}
    for row in rows:
        if row.slot_date is None:
            continue
        d = str(row.slot_date)
        if d not in data_map:
            data_map[d] = {"confirmed": 0, "cancelled": 0, "completed": 0, "no_show": 0}
        # Get status value properly
        if row.status and hasattr(row.status, 'value'):
            status_key = row.status.value
        else:
            status_key = str(row.status) if row.status else "pending"
        if status_key in data_map[d]:
            data_map[d][status_key] = row.cnt

    # Fill gaps for dates with no data
    trend_data = []
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        counts = data_map.get(d, {"confirmed": 0, "cancelled": 0, "completed": 0, "no_show": 0})
        trend_data.append(TrendDataPoint(date=d, **counts))

    return TrendResponse(range=range_str, data=trend_data)


async def get_upcoming_appointments(db: AsyncSession, limit: int = 50) -> list[UpcomingAppointment]:
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
            status=r.status.value if hasattr(r.status, 'value') else str(r.status),
            provider_name=r.provider_name,
        )
        for r in rows
    ]


async def get_channel_stats(db: AsyncSession) -> list[ChannelStats]:
    """Get appointment statistics grouped by source channel (WhatsApp vs Admin Dashboard)."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Get appointments from the last 7 days
    result = await db.execute(
        select(
            Appointment.source,
            Appointment.status,
            func.count(Appointment.id).label("cnt"),
        )
        .where(Appointment.created_at >= week_start)
        .group_by(Appointment.source, Appointment.status)
    )
    rows = result.all()

    # Build channel stats map
    channel_map: dict[str, dict] = {
        AppointmentSource.WHATSAPP.value: {
            "total": 0,
            "confirmed": 0,
            "cancelled": 0,
            "completed": 0,
            "no_show": 0,
        },
        AppointmentSource.ADMIN_DASHBOARD.value: {
            "total": 0,
            "confirmed": 0,
            "cancelled": 0,
            "completed": 0,
            "no_show": 0,
        },
    }

    for row in rows:
        source_key = row.source.value if hasattr(row.source, 'value') else str(row.source)
        status_key = row.status.value if hasattr(row.status, 'value') else str(row.status)
        
        if source_key in channel_map and status_key in channel_map[source_key]:
            channel_map[source_key][status_key] = row.cnt
            channel_map[source_key]["total"] += row.cnt

    # Calculate conversion rate (confirmed / total * 100)
    result_list = []
    for source, stats in channel_map.items():
        conversion_rate = 0.0
        if stats["total"] > 0:
            conversion_rate = round((stats["confirmed"] / stats["total"]) * 100, 1)
        
        result_list.append(ChannelStats(
            channel=source,
            total_appointments=stats["total"],
            confirmed=stats["confirmed"],
            cancelled=stats["cancelled"],
            completed=stats["completed"],
            no_show=stats["no_show"],
            conversion_rate=conversion_rate,
        ))

    # Sort by total appointments descending
    result_list.sort(key=lambda x: x.total_appointments, reverse=True)
    
    return result_list


async def get_channel_cancellation_stats(db: AsyncSession) -> list[ChannelCancellationStats]:
    """Get cancellation statistics grouped by cancellation source channel."""
    now = datetime.now(timezone.utc)
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)

    # Get cancelled appointments with their cancellation source
    result = await db.execute(
        select(
            Appointment.cancellation_source,
            func.count(Appointment.id).label("cnt"),
        )
        .where(
            Appointment.status == AppointmentStatus.CANCELLED,
            Appointment.created_at >= week_start,
            Appointment.cancellation_source.isnot(None),
        )
        .group_by(Appointment.cancellation_source)
    )
    rows = result.all()

    # Build cancellation stats map
    cancellation_map: dict[str, int] = {
        AppointmentSource.WHATSAPP.value: 0,
        AppointmentSource.ADMIN_DASHBOARD.value: 0,
    }

    for row in rows:
        source_key = row.cancellation_source.value if hasattr(row.cancellation_source, 'value') else str(row.cancellation_source)
        if source_key in cancellation_map:
            cancellation_map[source_key] = row.cnt

    # Calculate total cancellations
    total_cancellations = sum(cancellation_map.values())

    result_list = []
    for source, count in cancellation_map.items():
        percentage = 0.0
        if total_cancellations > 0:
            percentage = round((count / total_cancellations) * 100, 1)
        
        result_list.append(ChannelCancellationStats(
            channel=source,
            cancellations=count,
            percentage=percentage,
        ))

    # Sort by cancellations descending
    result_list.sort(key=lambda x: x.cancellations, reverse=True)
    
    return result_list


async def get_channel_reschedule_stats(db: AsyncSession) -> list[ChannelRescheduleStats]:
    """Get reschedule statistics grouped by reschedule source channel."""
    now = datetime.now(timezone.utc)
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)

    # Get rescheduled appointments with their reschedule source
    result = await db.execute(
        select(
            Appointment.reschedule_source,
            func.count(Appointment.id).label("cnt"),
        )
        .where(
            Appointment.rescheduled_from_slot_id.isnot(None),
            Appointment.created_at >= week_start,
            Appointment.reschedule_source.isnot(None),
        )
        .group_by(Appointment.reschedule_source)
    )
    rows = result.all()

    # Build reschedule stats map
    reschedule_map: dict[str, int] = {
        AppointmentSource.WHATSAPP.value: 0,
        AppointmentSource.ADMIN_DASHBOARD.value: 0,
    }

    for row in rows:
        source_key = row.reschedule_source.value if hasattr(row.reschedule_source, 'value') else str(row.reschedule_source)
        if source_key in reschedule_map:
            reschedule_map[source_key] = row.cnt

    # Calculate total reschedules
    total_reschedules = sum(reschedule_map.values())

    result_list = []
    for source, count in reschedule_map.items():
        percentage = 0.0
        if total_reschedules > 0:
            percentage = round((count / total_reschedules) * 100, 1)
        
        result_list.append(ChannelRescheduleStats(
            channel=source,
            reschedules=count,
            percentage=percentage,
        ))

    # Sort by reschedules descending
    result_list.sort(key=lambda x: x.reschedules, reverse=True)
    
    return result_list
