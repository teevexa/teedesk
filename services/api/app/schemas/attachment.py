from __future__ import annotations
from datetime import datetime
from uuid import UUID

from app.schemas.common import BaseSchema


class AttachmentResponse(BaseSchema):
    id: UUID
    message_id: UUID
    filename: str
    content_type: str
    size_bytes: int
    url: str | None
    created_at: datetime
