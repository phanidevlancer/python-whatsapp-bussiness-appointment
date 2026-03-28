from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.repositories import permission_repository as perm_repo
from app.schemas.permission import PermissionGroupRead, PermissionRead

router = APIRouter()


@router.get("/", response_model=list[PermissionGroupRead])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.view")),
):
    permissions = await perm_repo.list_permissions(db)
    grouped: dict[str, list[PermissionRead]] = defaultdict(list)
    for permission in permissions:
        grouped[permission.module].append(PermissionRead.model_validate(permission))
    return [
        PermissionGroupRead(module=module, permissions=items)
        for module, items in sorted(grouped.items(), key=lambda item: item[0])
    ]
