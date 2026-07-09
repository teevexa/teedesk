from __future__ import annotations
import uuid
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictException, NotFoundException
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate


class FeedbackService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, feedback_id: uuid.UUID) -> Feedback:
        fb = await self.db.get(Feedback, feedback_id)
        if fb is None:
            raise NotFoundException("Feedback", feedback_id)
        return fb

    async def list(
        self,
        conversation_id: uuid.UUID | None = None,
        message_id: uuid.UUID | None = None,
        rating: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[Sequence[Feedback], int]:
        stmt = select(Feedback)
        if conversation_id:
            stmt = stmt.where(Feedback.conversation_id == conversation_id)
        if message_id:
            stmt = stmt.where(Feedback.message_id == message_id)
        if rating:
            stmt = stmt.where(Feedback.rating == rating)

        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()

        stmt = stmt.order_by(Feedback.created_at.desc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def create(self, data: FeedbackCreate) -> Feedback:
        fb = Feedback(
            message_id=data.message_id,
            conversation_id=data.conversation_id,
            user_id=data.user_id,
            rating=data.rating,
            comment=data.comment,
        )
        self.db.add(fb)
        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise ConflictException("Feedback already submitted for this message by this user")
        await self.db.refresh(fb)
        return fb
