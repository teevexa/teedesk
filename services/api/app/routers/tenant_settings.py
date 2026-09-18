from __future__ import annotations
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_agent
from app.core.database import get_db
from app.models.user import User
from app.schemas.tenant_settings import TenantSettingsResponse, TenantSettingsUpdate
from app.services.tenant_settings_service import TenantSettingsService

router = APIRouter(prefix="/settings", tags=["Settings"])


def _svc(db: AsyncSession = Depends(get_db)) -> TenantSettingsService:
    return TenantSettingsService(db)


Svc = Annotated[TenantSettingsService, Depends(_svc)]
AuthUser = Annotated[User, Depends(get_current_user)]
AgentUser = Annotated[User, Depends(require_agent())]


@router.get("", response_model=TenantSettingsResponse)
async def get_settings(svc: Svc, current_user: AuthUser) -> TenantSettingsResponse:
    settings_row = await svc.get_or_create(current_user.tenant_id)
    return TenantSettingsResponse.model_validate(settings_row)


@router.patch("", response_model=TenantSettingsResponse)
async def update_settings(
    svc: Svc, body: TenantSettingsUpdate, current_user: AgentUser
) -> TenantSettingsResponse:
    settings_row = await svc.update(current_user.tenant_id, body)
    return TenantSettingsResponse.model_validate(settings_row)
