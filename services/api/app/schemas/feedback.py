from __future__ import annotations
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema

FeedbackRating = Literal["positive", "negative"]


class FeedbackCreate(BaseSchema):
    message_id: UUID
    conversation_id: UUID
    user_id: UUID | None = None
    rating: FeedbackRating
    comment: str | None = Field(None, max_length=2000)


class FeedbackResponse(TimestampSchema):
    id: UUID
    message_id: UUID
    conversation_id: UUID
    user_id: UUID | None
    rating: str
    comment: str | None
