"""
Lead Analytics API

Provides metrics and insights about lead performance:
- Conversion rates
- Response times
- Agent performance
- Lead sources
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, distinct, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.models.booking_drop_off import BookingDropOff, LeadStatus, CustomerType
from app.models.admin_user import AdminUser
from pydantic import BaseModel, Field


router = APIRouter()


class LeadMetrics(BaseModel):
    """Summary metrics for leads."""
    total_leads: int
    new_leads: int
    contacted_leads: int
    converted_leads: int
    lost_leads: int
    conversion_rate: float  # percentage
    average_response_hours: Optional[float]  # null if no data
    leads_by_customer_type: dict[str, int]
    leads_by_status: dict[str, int]


class AgentPerformance(BaseModel):
    """Performance metrics for a single agent."""
    agent_id: uuid.UUID
    agent_name: str
    total_leads: int
    converted_leads: int
    lost_leads: int
    conversion_rate: float
    average_response_hours: Optional[float]


class LeadTrendPoint(BaseModel):
    """Single data point for trend analysis."""
    date: str
    count: int


class LeadAnalyticsResponse(BaseModel):
    """Complete analytics response."""
    metrics: LeadMetrics
    trend: list[LeadTrendPoint]
    agent_performance: list[AgentPerformance]
    top_drop_off_steps: list[dict]


@router.get("/summary", response_model=LeadMetrics)
async def get_lead_metrics(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("reports.view")),
):
    """
    Get summary metrics for all leads.
    
    Includes:
    - Total counts by status
    - Conversion rate
    - Average response time
    - Breakdown by customer type
    """
    # Total counts
    total_q = select(func.count(BookingDropOff.id))
    total = (await db.execute(total_q)).scalar_one()
    
    # Counts by status
    status_q = select(
        BookingDropOff.status,
        func.count(BookingDropOff.id).label('count')
    ).group_by(BookingDropOff.status)
    status_result = await db.execute(status_q)
    leads_by_status = {row.status.value: row.count for row in status_result.all()}
    
    # Counts by customer type
    type_q = select(
        BookingDropOff.customer_type,
        func.count(BookingDropOff.id).label('count')
    ).group_by(BookingDropOff.customer_type)
    type_result = await db.execute(type_q)
    leads_by_customer_type = {row.customer_type.value: row.count for row in type_result.all()}
    
    # Conversion rate
    converted_count = leads_by_status.get('converted', 0)
    conversion_rate = (converted_count / total * 100) if total > 0 else 0.0
    
    # Average response time (first_contacted_at - created_at)
    response_time_q = select(
        func.avg(
            extract('epoch', BookingDropOff.first_contacted_at) - 
            extract('epoch', BookingDropOff.created_at)
        ).label('avg_seconds')
    ).where(
        BookingDropOff.first_contacted_at != None
    )
    avg_seconds = (await db.execute(response_time_q)).scalar_one()
    avg_response_hours = (avg_seconds / 3600) if avg_seconds else None
    
    return LeadMetrics(
        total_leads=total,
        new_leads=leads_by_status.get('new_lead', 0),
        contacted_leads=leads_by_status.get('contacted', 0),
        converted_leads=converted_count,
        lost_leads=leads_by_status.get('lost', 0),
        conversion_rate=round(conversion_rate, 2),
        average_response_hours=round(avg_response_hours, 2) if avg_response_hours else None,
        leads_by_customer_type=leads_by_customer_type,
        leads_by_status=leads_by_status,
    )


@router.get("/trend", response_model=list[LeadTrendPoint])
async def get_lead_trend(
    days: int = Query(30, ge=1, le=90, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("reports.view")),
):
    """
    Get daily lead creation trend.
    
    Shows how many leads were created each day for the past N days.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    trend_q = select(
        func.date(BookingDropOff.created_at).label('date'),
        func.count(BookingDropOff.id).label('count')
    ).where(
        BookingDropOff.created_at >= cutoff_date
    ).group_by(
        func.date(BookingDropOff.created_at)
    ).order_by(
        func.date(BookingDropOff.created_at)
    )
    
    result = await db.execute(trend_q)
    rows = result.all()
    
    return [
        LeadTrendPoint(
            date=row.date.isoformat(),
            count=row.count,
        )
        for row in rows
    ]


@router.get("/agents", response_model=list[AgentPerformance])
async def get_agent_performance(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("reports.view")),
):
    """
    Get performance metrics for each agent.
    
    Shows conversion rates and response times per agent.
    """
    query = select(
        AdminUser.id,
        AdminUser.name,
        func.count(BookingDropOff.id).label('total'),
        func.sum(func.case(
            (BookingDropOff.status == LeadStatus.CONVERTED, 1),
            else_=0
        )).label('converted'),
        func.sum(func.case(
            (BookingDropOff.status == LeadStatus.LOST, 1),
            else_=0
        )).label('lost'),
        func.avg(
            extract('epoch', BookingDropOff.first_contacted_at) - 
            extract('epoch', BookingDropOff.created_at)
        ).label('avg_response_seconds')
    ).join(
        BookingDropOff,
        BookingDropOff.assigned_to_id == AdminUser.id,
        isouter=True
    ).group_by(
        AdminUser.id,
        AdminUser.name
    ).order_by(
        func.count(BookingDropOff.id).desc()
    ).limit(limit)
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        AgentPerformance(
            agent_id=row.id,
            agent_name=row.name,
            total_leads=row.total or 0,
            converted_leads=row.converted or 0,
            lost_leads=row.lost or 0,
            conversion_rate=round((row.converted / row.total * 100) if row.total > 0 else 0, 2),
            average_response_hours=round(row.avg_response_seconds / 3600, 2) if row.avg_response_seconds else None,
        )
        for row in rows
    ]


@router.get("/drop-off-steps", response_model=list[dict])
async def get_drop_off_analysis(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("reports.view")),
):
    """
    Analyze where leads are dropping off in the booking flow.
    
    Shows which booking steps have the highest abandonment rates.
    """
    query = select(
        BookingDropOff.dropped_at_step,
        func.count(BookingDropOff.id).label('count'),
        func.avg(BookingDropOff.priority_score).label('avg_priority')
    ).group_by(
        BookingDropOff.dropped_at_step
    ).order_by(
        func.count(BookingDropOff.id).desc()
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    total = sum(row.count for row in rows)
    
    return [
        {
            "step": row.dropped_at_step,
            "count": row.count,
            "percentage": round((row.count / total * 100) if total > 0 else 0, 2),
            "avg_priority": round(row.avg_priority, 2) if row.avg_priority else None,
        }
        for row in rows
    ]


@router.get("/analytics", response_model=LeadAnalyticsResponse)
async def get_complete_analytics(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports.view")),
):
    """
    Get complete lead analytics dashboard data.
    
    Combines all analytics endpoints into a single response.
    """
    metrics = await get_lead_metrics(db=db, _=current_user)
    trend = await get_lead_trend(days=days, db=db, _=current_user)
    agent_perf = await get_agent_performance(db=db, _=current_user)
    drop_off = await get_drop_off_analysis(db=db, _=current_user)
    
    return LeadAnalyticsResponse(
        metrics=metrics,
        trend=trend,
        agent_performance=agent_perf,
        top_drop_off_steps=drop_off,
    )
