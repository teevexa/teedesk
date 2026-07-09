from __future__ import annotations
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema

TrainingSource = Literal["conversation", "manual", "synthetic"]


class TrainingDataCreate(BaseSchema):
    tenant_id: UUID
    message_id: UUID | None = None
    input_text: str = Field(..., min_length=1)
    labeled_intent: str | None = Field(None, max_length=100)
    labeled_sentiment: str | None = Field(None, max_length=20)
    labeled_entities: list[dict[str, Any]] = Field(default_factory=list)
    source: TrainingSource = "conversation"


class TrainingDataUpdate(BaseSchema):
    labeled_intent: str | None = Field(None, max_length=100)
    labeled_sentiment: str | None = Field(None, max_length=20)
    labeled_entities: list[dict[str, Any]] | None = None
    is_verified: bool | None = None
    verified_by: UUID | None = None


class TrainingDataResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    message_id: UUID | None
    input_text: str
    labeled_intent: str | None
    labeled_sentiment: str | None
    labeled_entities: list[dict[str, Any]]
    is_verified: bool
    verified_by: UUID | None
    source: str
