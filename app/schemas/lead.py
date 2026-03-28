import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.booking_drop_off import LeadStatus, CustomerType


class ServiceInfo(BaseModel):
    id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}


class AdminUserInfo(BaseModel):
    id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}


class CustomerInfo(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    phone: str
    model_config = {"from_attributes": True}


class LeadRead(BaseModel):
    id: uuid.UUID
    phone: str
    customer_id: Optional[uuid.UUID] = None
    customer: Optional[CustomerInfo] = None
    dropped_at_step: str
    selected_service_id: Optional[uuid.UUID] = None
    service: Optional[ServiceInfo] = None
    selected_slot_id: Optional[uuid.UUID] = None
    session_started_at: Optional[datetime] = None
    dropped_at: datetime
    status: LeadStatus
    customer_type: CustomerType
    assigned_to_id: Optional[uuid.UUID] = None
    assigned_to: Optional[AdminUserInfo] = None
    crm_notes: Optional[str] = None
    converted_appointment_id: Optional[uuid.UUID] = None
    
    # SLA tracking
    first_contacted_at: Optional[datetime] = None
    last_contacted_at: Optional[datetime] = None
    follow_up_at: Optional[datetime] = None
    
    # Lead scoring
    priority_score: Optional[int] = None
    
    created_at: datetime
    model_config = {"from_attributes": True}


class LeadUpdate(BaseModel):
    status: Optional[LeadStatus] = None
    assigned_to_id: Optional[uuid.UUID] = None
    crm_notes: Optional[str] = None
    follow_up_at: Optional[datetime] = None
    priority_score: Optional[int] = None


class LeadBulkUpdateRequest(BaseModel):
    lead_ids: list[uuid.UUID]
    status: Optional[LeadStatus] = None
    assigned_to_id: Optional[uuid.UUID] = None
    crm_notes: Optional[str] = None
    follow_up_at: Optional[datetime] = None


class LeadBulkAssignRequest(BaseModel):
    lead_ids: list[uuid.UUID]
    assigned_to_id: uuid.UUID


class LeadListResponse(BaseModel):
    items: list[LeadRead]
    total: int
    page: int
    page_size: int


class LeadConvertRequest(BaseModel):
    slot_id: uuid.UUID
    service_id: Optional[uuid.UUID] = None  # defaults to lead's service
    provider_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


# Activity schemas
class LeadActivityRead(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    activity_type: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    performed_by_id: Optional[uuid.UUID] = None
    performed_by: Optional[AdminUserInfo] = None
    performed_at: datetime
    metadata_json: Optional[str] = None
    model_config = {"from_attributes": True}


class LeadActivityCreate(BaseModel):
    lead_id: uuid.UUID
    activity_type: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    performed_by_id: Optional[uuid.UUID] = None
    metadata_json: Optional[str] = None


class LeadActivityListResponse(BaseModel):
    items: list[LeadActivityRead]
    total: int
