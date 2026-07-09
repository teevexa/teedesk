from __future__ import annotations
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema

SentimentLabel = Literal["positive", "negative", "neutral"]


class MessageCreate(BaseSchema):
    conversation_id: UUID
    sender_id: UUID | None = None
    content: str = Field(..., min_length=1)
    is_bot: bool = False
    metadata_: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata")


class MessageUpdate(BaseSchema):
    intent: str | None = Field(None, max_length=100)
    intent_confidence: float | None = Field(None, ge=0.0, le=1.0)
    sentiment: SentimentLabel | None = None
    sentiment_score: float | None = Field(None, ge=-1.0, le=1.0)
    entities: list[dict[str, Any]] | None = None
    knowledge_article_ids: list[str] | None = None
    metadata_: dict[str, Any] | None = Field(None, validation_alias="metadata")


class MessageResponse(TimestampSchema):
    id: UUID
    conversation_id: UUID
    sender_id: UUID | None
    content: str
    is_bot: bool
    status: str = "sent"
    intent: str | None
    intent_confidence: float | None
    sentiment: str | None
    sentiment_score: float | None
    entities: list[dict[str, Any]]
    knowledge_article_ids: list[str]
    metadata_: dict[str, Any] = Field(serialization_alias="metadata")
