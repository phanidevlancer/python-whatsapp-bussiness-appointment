from decimal import Decimal

from app.models.service import Service
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate


def test_service_model_and_schemas_include_cost() -> None:
    assert "cost" in Service.__table__.c.keys()

    create_payload = ServiceCreate(
        name="Hydra Facial",
        description="Deep cleanse",
        duration_minutes=60,
        cost=Decimal("2499.00"),
    )
    update_payload = ServiceUpdate(cost=Decimal("1999.00"))
    read_payload = ServiceRead(
        id="2f0f7c37-33eb-4f11-86e9-2d45d6ca77fe",
        name="Hydra Facial",
        description="Deep cleanse",
        duration_minutes=60,
        cost=Decimal("2499.00"),
        is_active=True,
    )

    assert create_payload.cost == Decimal("2499.00")
    assert update_payload.cost == Decimal("1999.00")
    assert read_payload.cost == Decimal("2499.00")
