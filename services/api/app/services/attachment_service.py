from __future__ import annotations
import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.core.storage import delete_file
from app.models.attachment import Attachment
from app.models.message import Message


class AttachmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        message: Message,
        upload_filename: str,
        content_type: str,
        size_bytes: int,
        storage_key: str,
        tenant_id: uuid.UUID,
    ) -> Attachment:
        attachment = Attachment(
            message_id=message.id,
            tenant_id=tenant_id,
            filename=upload_filename,
            content_type=content_type,
            size_bytes=size_bytes,
            storage_key=storage_key,
        )
        self.db.add(attachment)
        await self.db.flush()
        await self.db.refresh(attachment)
        return attachment

    async def get(self, attachment_id: uuid.UUID) -> Attachment:
        attachment = await self.db.get(Attachment, attachment_id)
        if attachment is None:
            raise NotFoundException("Attachment", attachment_id)
        return attachment

    async def delete(self, attachment_id: uuid.UUID) -> None:
        attachment = await self.get(attachment_id)
        delete_file(attachment.storage_key)
        await self.db.delete(attachment)
        await self.db.flush()

    async def list_for_message(self, message_id: uuid.UUID) -> Sequence[Attachment]:
        stmt = (
            select(Attachment)
            .where(Attachment.message_id == message_id)
            .order_by(Attachment.created_at.asc())
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows
