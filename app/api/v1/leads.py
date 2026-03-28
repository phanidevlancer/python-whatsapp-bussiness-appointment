import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.models.booking_drop_off import LeadStatus, CustomerType
from app.repositories import lead_repository as lead_repo
from app.schemas.lead import (
    LeadConvertRequest,
    LeadListResponse,
    LeadRead,
    LeadUpdate,
    LeadBulkUpdateRequest,
    LeadBulkAssignRequest,
    LeadActivityListResponse,
    LeadActivityRead,
)
from app.schemas.appointment_crm import AppointmentCRMRead
from app.services import lead_service
from app.repositories import appointment_repository as appt_repo

router = APIRouter()


@router.get("/", response_model=LeadListResponse)
async def list_leads(
    status: Optional[LeadStatus] = Query(None),
    customer_type: Optional[CustomerType] = Query(None),
    assigned_to_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("leads.view")),
):
    items, total = await lead_repo.list_leads(
        db,
        status=status,
        customer_type=customer_type,
        assigned_to_id=assigned_to_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    return LeadListResponse(
        items=[LeadRead.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("leads.view")),
):
    lead = await lead_repo.get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadRead.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("leads.update")),
):
    lead = await lead_repo.update_lead(
        db,
        lead_id=lead_id,
        status=payload.status,
        assigned_to_id=payload.assigned_to_id,
        crm_notes=payload.crm_notes,
        follow_up_at=payload.follow_up_at,
        priority_score=payload.priority_score,
        current_user_id=current_user.id,
        log_activity=True,
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadRead.model_validate(lead)


@router.post("/{lead_id}/convert", response_model=AppointmentCRMRead)
async def convert_lead(
    lead_id: uuid.UUID,
    payload: LeadConvertRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("leads.update")),
    _=Depends(require_permission("appointments.create")),
):
    appt = await lead_service.convert_lead(db, lead_id, payload, current_user)
    appt = await appt_repo.get_appointment_crm_by_id(db, appt.id)
    return AppointmentCRMRead.model_validate(appt)


@router.post("/bulk/update", response_model=dict)
async def bulk_update_leads(
    payload: LeadBulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("leads.update")),
):
    """
    Bulk update multiple leads with the same values.
    
    Updates status, assignment, and/or notes for all specified leads.
    Each change is logged in the activity history.
    """
    if not payload.lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")
    
    updated_count = await lead_repo.bulk_update_leads(
        db,
        lead_ids=payload.lead_ids,
        status=payload.status,
        assigned_to_id=payload.assigned_to_id,
        crm_notes=payload.crm_notes,
        current_user_id=current_user.id,
    )
    
    return {
        "updated_count": updated_count,
        "total_requested": len(payload.lead_ids),
    }


@router.post("/bulk/assign", response_model=dict)
async def bulk_assign_leads(
    payload: LeadBulkAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("leads.assign")),
):
    """
    Bulk assign multiple leads to a specific agent.
    
    Args:
        payload: Contains lead_ids and assigned_to_id
    """
    if not payload.lead_ids:
        raise HTTPException(status_code=400, detail="No lead IDs provided")
    
    updated_count = await lead_repo.bulk_update_leads(
        db,
        lead_ids=payload.lead_ids,
        assigned_to_id=payload.assigned_to_id,
        current_user_id=current_user.id,
    )
    
    return {
        "updated_count": updated_count,
        "total_requested": len(payload.lead_ids),
        "assigned_to_id": str(payload.assigned_to_id),
    }


@router.get("/{lead_id}/activity", response_model=LeadActivityListResponse)
async def get_lead_activity(
    lead_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("leads.view")),
):
    """
    Get activity history for a specific lead.
    
    Shows all status changes, assignments, notes, and other activities.
    """
    # Verify lead exists
    lead = await lead_repo.get_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    items, total = await lead_repo.get_lead_activities(
        db,
        lead_id=lead_id,
        page=page,
        page_size=page_size,
    )
    
    return LeadActivityListResponse(
        items=[LeadActivityRead.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{lead_id}/follow-up", response_model=LeadRead)
async def schedule_follow_up(
    lead_id: uuid.UUID,
    follow_up_at: Optional[str] = Query(None, description="ISO 8601 datetime for follow-up"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("leads.update")),
):
    """
    Schedule or cancel a follow-up reminder for a lead.
    
    Pass follow_up_at=null to cancel a scheduled follow-up.
    """
    from datetime import datetime
    
    follow_up_datetime = None
    if follow_up_at:
        try:
            follow_up_datetime = datetime.fromisoformat(follow_up_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")
    
    lead = await lead_repo.update_lead(
        db,
        lead_id=lead_id,
        follow_up_at=follow_up_datetime,
        current_user_id=current_user.id,
        log_activity=True,
    )
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return LeadRead.model_validate(lead)
