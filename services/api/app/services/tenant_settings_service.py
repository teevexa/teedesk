from __future__ import annotations
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant_settings import TenantSettings
from app.schemas.tenant_settings import TenantSettingsUpdate


class TenantSettingsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_or_create(self, tenant_id: uuid.UUID) -> TenantSettings:
        """Fetch the tenant's settings row, creating it with defaults on first access.

        This means every tenant implicitly has a settings row without needing
        a migration data-backfill — the row is materialized the first time
        anything (the API, or the AI pipeline) asks for it.
        """
        settings_row = await self.db.get(TenantSettings, tenant_id)
        if settings_row is None:
            settings_row = TenantSettings(tenant_id=tenant_id)
            self.db.add(settings_row)
            await self.db.flush()
            await self.db.refresh(settings_row)
        return settings_row

    async def update(self, tenant_id: uuid.UUID, data: TenantSettingsUpdate) -> TenantSettings:
        settings_row = await self.get_or_create(tenant_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(settings_row, field, value)
        await self.db.flush()
        await self.db.refresh(settings_row)
        return settings_row
