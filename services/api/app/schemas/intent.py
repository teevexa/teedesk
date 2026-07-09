from __future__ import annotations
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema


class IntentCreate(BaseSchema):
    tenant_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    examples: list[str] = Field(default_factory=list)
    response_template: str | None = None
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class IntentUpdate(BaseSchema):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    examples: list[str] | None = None
    response_template: str | None = None
    confidence_threshold: float | None = Field(None, ge=0.0, le=1.0)
    is_active: bool | None = None


class IntentResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    examples: list[str]
    response_template: str | None
    confidence_threshold: float
    is_active: bool
