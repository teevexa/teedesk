from __future__ import annotations
from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema


class EscalationCreate(BaseSchema):
    conversation_id: UUID
    triggered_by_message_id: UUID | None = None
    reason: str | None = None
    reason_code: str | None = Field(None, max_length=50)
    sentiment_score: float | None = None


class EscalationUpdate(BaseSchema):
    assigned_agent_id: UUID | None = None
    resolved_at: datetime | None = None
    resolution_notes: str | None = None


class EscalationResponse(TimestampSchema):
    id: UUID
    conversation_id: UUID
    triggered_by_message_id: UUID | None
    assigned_agent_id: UUID | None
    reason: str | None
    reason_code: str | None
    sentiment_score: float | None
    resolved_at: datetime | None
    resolution_notes: str | None
