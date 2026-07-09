from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.conversation import Conversation
from app.models.escalation import Escalation
from app.schemas.conversation import ConversationCreate, ConversationUpdate, EscalateRequest
from app.schemas.escalation import EscalationCreate


class ConversationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, conversation_id: uuid.UUID) -> Conversation:
        conv = await self.db.get(Conversation, conversation_id)
        if conv is None or conv.is_deleted:
            raise NotFoundException("Conversation", conversation_id)
        return conv

    async def list(
        self,
        tenant_id: uuid.UUID,
        status: str | None = None,
        channel: str | None = None,
        user_id: uuid.UUID | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[Sequence[Conversation], int]:
        stmt = select(Conversation).where(
            Conversation.tenant_id == tenant_id,
            Conversation.deleted_at.is_(None),
        )
        if status:
            stmt = stmt.where(Conversation.status == status)
        if channel:
            stmt = stmt.where(Conversation.channel == channel)
        if user_id:
            stmt = stmt.where(Conversation.user_id == user_id)

        total_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(total_stmt)).scalar_one()

        stmt = stmt.order_by(Conversation.created_at.desc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def create(self, data: ConversationCreate) -> Conversation:
        conv = Conversation(
            tenant_id=data.tenant_id,
            user_id=data.user_id,
            channel=data.channel,
            title=data.title,
            metadata_=data.metadata_,
        )
        self.db.add(conv)
        await self.db.flush()
        await self.db.refresh(conv)
        return conv

    async def update(self, conversation_id: uuid.UUID, data: ConversationUpdate) -> Conversation:
        conv = await self.get(conversation_id)
        for field, value in data.model_dump(exclude_none=True, by_alias=False).items():
            setattr(conv, field, value)
        await self.db.flush()
        await self.db.refresh(conv)
        return conv

    async def resolve(self, conversation_id: uuid.UUID) -> Conversation:
        conv = await self.get(conversation_id)
        if conv.status == "resolved":
            raise BadRequestException("Conversation is already resolved")
        conv.status = "resolved"
        conv.resolved_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.refresh(conv)
        return conv

    async def escalate(self, conversation_id: uuid.UUID, req: EscalateRequest) -> Conversation:
        conv = await self.get(conversation_id)
        if conv.status in ("resolved", "closed"):
            raise BadRequestException(f"Cannot escalate a {conv.status} conversation")

        # Check no existing open escalation
        existing = (
            await self.db.execute(
                select(Escalation).where(
                    Escalation.conversation_id == conversation_id,
                    Escalation.resolved_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise BadRequestException("Conversation already has an open escalation")

        conv.status = "escalated"
        escalation = Escalation(
            conversation_id=conversation_id,
            triggered_by_message_id=req.triggered_by_message_id,
            reason=req.reason,
            reason_code=req.reason_code,
            sentiment_score=req.sentiment_score,
        )
        self.db.add(escalation)
        await self.db.flush()
        await self.db.refresh(conv)
        return conv

    async def soft_delete(self, conversation_id: uuid.UUID) -> None:
        conv = await self.get(conversation_id)
        conv.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
