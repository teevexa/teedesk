from __future__ import annotations
import uuid
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException
from app.models.intent import Intent
from app.schemas.intent import IntentCreate, IntentUpdate


class IntentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, intent_id: uuid.UUID) -> Intent:
        intent = await self.db.get(Intent, intent_id)
        if intent is None:
            raise NotFoundException("Intent", intent_id)
        return intent

    async def list(
        self,
        tenant_id: uuid.UUID,
        is_active: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[Sequence[Intent], int]:
        stmt = select(Intent).where(Intent.tenant_id == tenant_id)
        if is_active is not None:
            stmt = stmt.where(Intent.is_active == is_active)

        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()

        stmt = stmt.order_by(Intent.name.asc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def create(self, data: IntentCreate) -> Intent:
        intent = Intent(
            tenant_id=data.tenant_id,
            name=data.name,
            description=data.description,
            examples=data.examples,
            response_template=data.response_template,
            confidence_threshold=data.confidence_threshold,
        )
        self.db.add(intent)
        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise ConflictException(f"Intent '{data.name}' already exists for this tenant")
        await self.db.refresh(intent)
        return intent

    async def update(self, intent_id: uuid.UUID, data: IntentUpdate) -> Intent:
        intent = await self.get(intent_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(intent, field, value)
        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise ConflictException(f"Intent name already exists for this tenant")
        await self.db.refresh(intent)
        return intent

    async def delete(self, intent_id: uuid.UUID) -> None:
        intent = await self.get(intent_id)
        await self.db.delete(intent)
        await self.db.flush()
