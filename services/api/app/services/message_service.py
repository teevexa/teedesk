from __future__ import annotations
import uuid
from typing import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.message import MessageCreate, MessageUpdate


class MessageService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, message_id: uuid.UUID) -> Message:
        msg = await self.db.get(Message, message_id)
        if msg is None:
            raise NotFoundException("Message", message_id)
        return msg

    async def list_for_conversation(
        self,
        conversation_id: uuid.UUID,
        page: int = 1,
        size: int = 50,
    ) -> tuple[Sequence[Message], int]:
        # Verify conversation exists
        conv = await self.db.get(Conversation, conversation_id)
        if conv is None or conv.is_deleted:
            raise NotFoundException("Conversation", conversation_id)

        stmt = select(Message).where(Message.conversation_id == conversation_id)
        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()

        stmt = stmt.order_by(Message.created_at.asc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def list(
        self,
        tenant_id: uuid.UUID,
        is_bot: bool | None = None,
        intent: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[Sequence[Message], int]:
        # Messages have no tenant_id of their own — scope via their conversation.
        stmt = (
            select(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.tenant_id == tenant_id)
        )
        if is_bot is not None:
            stmt = stmt.where(Message.is_bot == is_bot)
        if intent:
            stmt = stmt.where(Message.intent == intent)

        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()

        stmt = stmt.order_by(Message.created_at.desc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def create(self, data: MessageCreate, conversation: Conversation) -> Message:
        # `conversation` is passed in already fetched + tenant/owner-verified by the caller.
        msg = Message(
            conversation_id=data.conversation_id,
            sender_id=data.sender_id,
            content=data.content,
            is_bot=data.is_bot,
            metadata_=data.metadata_,
        )
        self.db.add(msg)

        # Atomically increment message_count on the conversation
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == data.conversation_id)
            .values(message_count=Conversation.message_count + 1)
        )

        await self.db.flush()
        await self.db.refresh(msg)
        return msg

    async def update(self, message_id: uuid.UUID, data: MessageUpdate) -> Message:
        msg = await self.get(message_id)
        for field, value in data.model_dump(exclude_none=True, by_alias=False).items():
            setattr(msg, field, value)
        await self.db.flush()
        await self.db.refresh(msg)
        return msg
