from __future__ import annotations
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema


class ArticleCreate(BaseSchema):
    tenant_id: UUID
    author_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    category: str | None = Field(None, max_length=100)
    tags: list[str] = Field(default_factory=list)
    is_published: bool = True
    source_url: str | None = Field(None, max_length=512)


class ArticleUpdate(BaseSchema):
    title: str | None = Field(None, min_length=1, max_length=500)
    content: str | None = Field(None, min_length=1)
    category: str | None = Field(None, max_length=100)
    tags: list[str] | None = None
    is_published: bool | None = None
    source_url: str | None = Field(None, max_length=512)


class ArticleResponse(TimestampSchema):
    id: UUID
    tenant_id: UUID
    author_id: UUID | None
    title: str
    content: str
    category: str | None
    tags: list[str]
    views: int
    helpful_count: int
    not_helpful_count: int
    is_published: bool
    source_url: str | None
