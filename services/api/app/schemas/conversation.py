from __future__ import annotations
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema

ConversationStatus = Literal["open", "escalated", "resolved", "closed"]
ConversationChannel = Literal["web", "mobile", "whatsapp", "telegram"]


class ConversationCreate(BaseSchema):
    tenant_id: UUID | None = None   # injected from current_user in router
    user_id: UUID | None = None     # injected from current_user in router
    channel: ConversationChannel = "web"
    title: str | None = Field(None, max_length=255)
    metadata_: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata")


class ConversationUpdate(BaseSchema):
    assigned_agent_id: UUID | None = None
    title: str | None = Field(None, max_length=255)
    metadata_: dict[str, Any] | None = Field(None, validation_alias="metadata")


class ConversationResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    assigned_agent_id: UUID | None
    status: str
    channel: str
    title: str | None
    sentiment_score: float | None
    message_count: int
    resolved_at: datetime | None
    metadata_: dict[str, Any] = Field(serialization_alias="metadata")


class EscalateRequest(BaseSchema):
    reason: str | None = None
    reason_code: str | None = Field(None, max_length=50)
    sentiment_score: float | None = None
    triggered_by_message_id: UUID | None = None
