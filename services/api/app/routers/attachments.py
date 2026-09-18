from __future__ import annotations
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_agent, verify_conversation_access
from app.core.database import get_db
from app.core.storage import (
    generate_storage_key,
    resolve_storage_path,
    sanitized_display_filename,
    save_file,
    validate_upload_size,
)
from app.models.user import User
from app.schemas.attachment import AttachmentResponse
from app.services.attachment_service import AttachmentService
from app.services.conversation_service import ConversationService
from app.services.message_service import MessageService

router = APIRouter(tags=["Attachments"])


def _svc(db: AsyncSession = Depends(get_db)) -> AttachmentService:
    return AttachmentService(db)


def _msg_svc(db: AsyncSession = Depends(get_db)) -> MessageService:
    return MessageService(db)


def _conv_svc(db: AsyncSession = Depends(get_db)) -> ConversationService:
    return ConversationService(db)


Svc = Annotated[AttachmentService, Depends(_svc)]
MsgSvc = Annotated[MessageService, Depends(_msg_svc)]
ConvSvc = Annotated[ConversationService, Depends(_conv_svc)]
AuthUser = Annotated[User, Depends(get_current_user)]


@router.post(
    "/messages/{message_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    svc: Svc,
    msg_svc: MsgSvc,
    conv_svc: ConvSvc,
    message_id: uuid.UUID,
    current_user: AuthUser,
    file: UploadFile = File(...),
) -> AttachmentResponse:
    msg = await msg_svc.get(message_id)
    conv = await conv_svc.get(msg.conversation_id)
    verify_conversation_access(conv, current_user)

    data = await file.read()
    validate_upload_size(len(data))

    display_filename = sanitized_display_filename(file.filename or "")
    storage_key = generate_storage_key(display_filename)
    save_file(data, storage_key)

    attachment = await svc.create(
        message=msg,
        upload_filename=display_filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
        storage_key=storage_key,
        tenant_id=conv.tenant_id,
    )
    return AttachmentResponse.model_validate(attachment)


@router.get("/attachments/{attachment_id}")
async def download_attachment(
    svc: Svc,
    msg_svc: MsgSvc,
    conv_svc: ConvSvc,
    attachment_id: uuid.UUID,
    current_user: AuthUser,
) -> FileResponse:
    attachment = await svc.get(attachment_id)
    msg = await msg_svc.get(attachment.message_id)
    conv = await conv_svc.get(msg.conversation_id)
    verify_conversation_access(conv, current_user)

    path = resolve_storage_path(attachment.storage_key)
    return FileResponse(
        path=path,
        media_type=attachment.content_type,
        filename=attachment.filename,
        content_disposition_type="attachment",
    )


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_attachment(
    svc: Svc,
    msg_svc: MsgSvc,
    conv_svc: ConvSvc,
    attachment_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_agent())],
) -> Response:
    attachment = await svc.get(attachment_id)
    msg = await msg_svc.get(attachment.message_id)
    conv = await conv_svc.get(msg.conversation_id)
    verify_conversation_access(conv, current_user)

    await svc.delete(attachment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
