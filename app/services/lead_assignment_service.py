"""
Lead Assignment Service

Provides automatic lead assignment strategies:
- Round-robin: Distributes leads evenly among available agents
- Load-based: Assigns to agent with fewest active leads
- Manual: No automatic assignment (default)
"""

import logging
from typing import Optional
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking_drop_off import BookingDropOff, LeadStatus
from app.models.admin_user import AdminUser
from app.repositories import lead_repository as lead_repo
from app.models.lead_activity import LeadActivityType

logger = logging.getLogger(__name__)


class AssignmentStrategy:
    """Enum-like class for assignment strategies."""
    NONE = "none"  # No automatic assignment
    ROUND_ROBIN = "round_robin"  # Distribute evenly
    LOAD_BASED = "load_based"  # Assign to least busy agent


async def get_available_agents(db: AsyncSession) -> list[AdminUser]:
    """
    Get all active admin users who can be assigned leads.
    
    In the future, this could filter by:
    - Active status
    - Role/permissions
    - Working hours
    - Current workload capacity
    """
    result = await db.execute(
        select(AdminUser)
        .where(AdminUser.is_active == True)
        .order_by(AdminUser.name)
    )
    return list(result.scalars().all())


async def get_agent_lead_counts(
    db: AsyncSession,
    agent_ids: list[uuid.UUID],
) -> dict[uuid.UUID, int]:
    """
    Get count of active (non-converted, non-lost) leads for each agent.
    
    Returns:
        Dictionary mapping agent_id to their active lead count
    """
    if not agent_ids:
        return {}
    
    result = await db.execute(
        select(
            BookingDropOff.assigned_to_id,
            func.count(BookingDropOff.id).label("lead_count")
        )
        .where(
            BookingDropOff.assigned_to_id.in_(agent_ids),
            BookingDropOff.status.notin_([LeadStatus.CONVERTED, LeadStatus.LOST]),
        )
        .group_by(BookingDropOff.assigned_to_id)
    )
    
    # Initialize all agents with 0 count
    counts = {agent_id: 0 for agent_id in agent_ids}
    
    # Update with actual counts
    for row in result.all():
        counts[row.assigned_to_id] = row.lead_count
    
    return counts


async def assign_round_robin(
    db: AsyncSession,
    lead_id: uuid.UUID,
    current_user_id: Optional[uuid.UUID] = None,
) -> Optional[uuid.UUID]:
    """
    Assign lead using round-robin strategy.
    
    Tracks the last assigned agent index in Redis (or memory) to ensure
    even distribution. For simplicity, we'll use the agent with fewest
    active leads as a proxy for round-robin.
    
    Returns:
        UUID of assigned agent, or None if no agents available
    """
    agents = await get_available_agents(db)
    
    if not agents:
        logger.warning("No available agents for round-robin assignment")
        return None
    
    # Get lead counts for all agents
    lead_counts = await get_agent_lead_counts(db, [a.id for a in agents])
    
    # Find agent(s) with minimum load
    min_count = min(lead_counts.values())
    available_agents = [
        agent for agent in agents
        if lead_counts[agent.id] == min_count
    ]
    
    # If multiple agents have same load, pick first alphabetically
    chosen_agent = sorted(available_agents, key=lambda a: a.name)[0]
    
    # Assign the lead
    await lead_repo.update_lead(
        db,
        lead_id=lead_id,
        assigned_to_id=chosen_agent.id,
        current_user_id=current_user_id,
        log_activity=True,
    )
    
    logger.info(
        "Lead %s assigned to %s via round-robin (load: %d active leads)",
        lead_id, chosen_agent.name, min_count
    )
    
    return chosen_agent.id


async def assign_load_based(
    db: AsyncSession,
    lead_id: uuid.UUID,
    current_user_id: Optional[uuid.UUID] = None,
) -> Optional[uuid.UUID]:
    """
    Assign lead to agent with fewest active leads.
    
    This is similar to round-robin but explicitly considers current workload.
    
    Returns:
        UUID of assigned agent, or None if no agents available
    """
    agents = await get_available_agents(db)
    
    if not agents:
        logger.warning("No available agents for load-based assignment")
        return None
    
    # Get lead counts for all agents
    lead_counts = await get_agent_lead_counts(db, [a.id for a in agents])
    
    # Find agent with minimum load
    min_count = min(lead_counts.values())
    available_agents = [
        agent for agent in agents
        if lead_counts[agent.id] == min_count
    ]
    
    # If multiple agents have same load, pick the one who was assigned least recently
    # For now, just pick first alphabetically
    chosen_agent = sorted(available_agents, key=lambda a: a.name)[0]
    
    # Assign the lead
    await lead_repo.update_lead(
        db,
        lead_id=lead_id,
        assigned_to_id=chosen_agent.id,
        current_user_id=current_user_id,
        log_activity=True,
    )
    
    logger.info(
        "Lead %s assigned to %s via load-based (load: %d active leads)",
        lead_id, chosen_agent.name, min_count
    )
    
    return chosen_agent.id


async def auto_assign_lead(
    db: AsyncSession,
    lead_id: uuid.UUID,
    strategy: str = AssignmentStrategy.ROUND_ROBIN,
    current_user_id: Optional[uuid.UUID] = None,
) -> Optional[uuid.UUID]:
    """
    Automatically assign a lead based on the configured strategy.
    
    Args:
        db: Database session
        lead_id: Lead to assign
        strategy: Assignment strategy (none, round_robin, load_based)
        current_user_id: ID of user triggering the assignment (for logging)
        
    Returns:
        UUID of assigned agent, or None if not assigned
    """
    if strategy == AssignmentStrategy.NONE:
        return None
    
    if strategy == AssignmentStrategy.ROUND_ROBIN:
        return await assign_round_robin(db, lead_id, current_user_id)
    
    if strategy == AssignmentStrategy.LOAD_BASED:
        return await assign_load_based(db, lead_id, current_user_id)
    
    logger.warning("Unknown assignment strategy: %s", strategy)
    return None


def calculate_priority_score(
    customer_type: str,
    dropped_at_step: str,
    days_since_dropoff: int = 0,
) -> int:
    """
    Calculate lead priority score (0-100).

    Higher scores = higher priority.

    Factors:
    - Customer type: returning (40) > re_engaged (30) > prospect (20)
    - Drop-off step: slot_selected (30) > service_selected (20) > other (10)
    - Recency: +10 if < 1 day, +5 if < 3 days
    """
    score = 0

    # Customer type scoring
    customer_type_scores = {
        "returning": 40,
        "re_engaged": 30,
        "prospect": 20,
    }
    score += customer_type_scores.get(customer_type, 20)

    # Drop-off step scoring
    step_scores = {
        "SLOT_SELECTED": 30,
        "SERVICE_SELECTED": 20,
        "AWAITING_EMAIL": 15,
        "AWAITING_NAME": 15,
        "APPOINTMENT_CANCELLED": 35,
    }
    score += step_scores.get(dropped_at_step, 10)

    # Recency scoring
    if days_since_dropoff == 0:
        score += 10
    elif days_since_dropoff < 3:
        score += 5

    return min(score, 100)  # Cap at 100
