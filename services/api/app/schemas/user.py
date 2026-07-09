from __future__ import annotations
from typing import Any, Literal
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema, TimestampSchema

UserRole = Literal["customer", "agent", "admin"]


class UserCreate(BaseSchema):
    tenant_id: UUID
    email: EmailStr | None = None
    name: str | None = Field(None, max_length=255)
    role: UserRole = "customer"
    avatar_url: str | None = Field(None, max_length=512)
    metadata_: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata")


class UserUpdate(BaseSchema):
    email: EmailStr | None = None
    name: str | None = Field(None, max_length=255)
    role: UserRole | None = None
    avatar_url: str | None = Field(None, max_length=512)
    is_active: bool | None = None
    metadata_: dict[str, Any] | None = Field(None, validation_alias="metadata")


class UserResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    email: str | None
    name: str | None
    role: str
    avatar_url: str | None
    is_active: bool
    metadata_: dict[str, Any] = Field(serialization_alias="metadata")
