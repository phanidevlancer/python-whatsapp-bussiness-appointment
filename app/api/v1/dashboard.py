from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.schemas.dashboard import (
    DashboardStats,
    TrendResponse,
    UpcomingAppointment,
    ChannelStats,
    ChannelCancellationStats,
    ChannelRescheduleStats,
)
from app.schemas.campaign import CampaignPerformance
from app.services import dashboard_service

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("dashboard.view")),
):
    return await dashboard_service.get_stats(db)


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    range: str = Query("7d", pattern="^(7d|30d|90d)$"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("dashboard.view")),
):
    return await dashboard_service.get_trends(db, range_str=range)


@router.get("/upcoming", response_model=list[UpcomingAppointment])
async def get_upcoming(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("dashboard.view")),
):
    return await dashboard_service.get_upcoming_appointments(db, limit=limit)


@router.get("/channels", response_model=list[ChannelStats])
async def get_channel_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("dashboard.view")),
):
    return await dashboard_service.get_channel_stats(db)


@router.get("/cancellations", response_model=list[ChannelCancellationStats])
async def get_cancellation_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("dashboard.view")),
):
    return await dashboard_service.get_channel_cancellation_stats(db)


@router.get("/reschedules", response_model=list[ChannelRescheduleStats])
async def get_reschedule_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("dashboard.view")),
):
    return await dashboard_service.get_channel_reschedule_stats(db)


@router.get("/campaigns", response_model=list[CampaignPerformance])
async def get_campaign_performance(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("dashboard.view")),
):
    return await dashboard_service.get_campaign_performance(db)
