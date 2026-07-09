from __future__ import annotations
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.common import BaseSchema, TimestampSchema

PlanType = Literal["free", "starter", "business", "enterprise"]


class TenantCreate(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan: PlanType = "free"
    settings: dict[str, Any] = Field(default_factory=dict)

    @field_validator("slug")
    @classmethod
    def slug_lowercase(cls, v: str) -> str:
        return v.lower()


class TenantUpdate(BaseSchema):
    name: str | None = Field(None, min_length=1, max_length=255)
    plan: PlanType | None = None
    is_active: bool | None = None
    settings: dict[str, Any] | None = None


class TenantResponse(TimestampSchema):
    id: UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    settings: dict[str, Any]
