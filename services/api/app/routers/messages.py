from __future__ import annotations
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse, MessageUpdate
from app.services.message_service import MessageService

router = APIRouter(prefix="/messages", tags=["Messages"])


def _svc(db: AsyncSession = Depends(get_db)) -> MessageService:
    return MessageService(db)


Svc = Annotated[MessageService, Depends(_svc)]
Pagination = Annotated[PaginationParams, Depends()]
AuthUser = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[MessageResponse])
async def list_messages(
    svc: Svc,
    pagination: Pagination,
    current_user: AuthUser,
    conversation_id: uuid.UUID | None = Query(None),
    is_bot: bool | None = Query(None),
    intent: str | None = Query(None),
) -> PaginatedResponse[MessageResponse]:
    if conversation_id:
        items, total = await svc.list_for_conversation(
            conversation_id, page=pagination.page, size=pagination.size
        )
    else:
        items, total = await svc.list(
            is_bot=is_bot, intent=intent, page=pagination.page, size=pagination.size
        )
    return PaginatedResponse(
        items=[MessageResponse.model_validate(m) for m in items],
        total=total,
        page=pagination.page,
        size=pagination.size,
        pages=max(1, -(-total // pagination.size)),
        has_next=pagination.page < max(1, -(-total // pagination.size)),
        has_prev=pagination.page > 1,
    )


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    svc: Svc, body: MessageCreate, current_user: AuthUser
) -> MessageResponse:
    if not body.sender_id:
        body.sender_id = current_user.id
    msg = await svc.create(body)
    return MessageResponse.model_validate(msg)


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    svc: Svc, message_id: uuid.UUID, current_user: AuthUser
) -> MessageResponse:
    msg = await svc.get(message_id)
    return MessageResponse.model_validate(msg)


@router.patch("/{message_id}", response_model=MessageResponse)
async def update_message(
    svc: Svc, message_id: uuid.UUID, body: MessageUpdate, current_user: AuthUser
) -> MessageResponse:
    msg = await svc.update(message_id, body)
    return MessageResponse.model_validate(msg)
