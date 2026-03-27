from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user
from app.db.session import get_db
from app.schemas.dashboard import DashboardStats, TrendResponse, UpcomingAppointment, ChannelStats
from app.services import dashboard_service

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    return await dashboard_service.get_stats(db)


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    range: str = Query("7d", pattern="^(7d|30d|90d)$"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    return await dashboard_service.get_trends(db, range_str=range)


@router.get("/upcoming", response_model=list[UpcomingAppointment])
async def get_upcoming(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    return await dashboard_service.get_upcoming_appointments(db, limit=limit)


@router.get("/channels", response_model=list[ChannelStats])
async def get_channel_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin_user),
):
    return await dashboard_service.get_channel_stats(db)
