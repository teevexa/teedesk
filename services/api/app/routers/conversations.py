from __future__ import annotations
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user,
    require_agent,
    verify_conversation_access,
    verify_tenant_access,
)
from app.core.database import get_db
from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    EscalateRequest,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["Conversations"])


def _svc(db: AsyncSession = Depends(get_db)) -> ConversationService:
    return ConversationService(db)


Svc = Annotated[ConversationService, Depends(_svc)]
Pagination = Annotated[PaginationParams, Depends()]
AuthUser = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[ConversationResponse])
async def list_conversations(
    svc: Svc,
    pagination: Pagination,
    current_user: AuthUser,
    tenant_id: Optional[uuid.UUID] = Query(default=None),
    status_filter: str | None = Query(None, alias="status"),
    channel: str | None = Query(None),
    user_id: uuid.UUID | None = Query(None),
) -> PaginatedResponse[ConversationResponse]:
    # Use caller's tenant unless super_admin passes explicit tenant_id
    effective_tenant = tenant_id if (current_user.role == "super_admin" and tenant_id) else current_user.tenant_id
    items, total = await svc.list(
        tenant_id=effective_tenant,
        status=status_filter,
        channel=channel,
        user_id=user_id,
        page=pagination.page,
        size=pagination.size,
    )
    return PaginatedResponse(
        items=[ConversationResponse.model_validate(c) for c in items],
        total=total,
        page=pagination.page,
        size=pagination.size,
        pages=max(1, -(-total // pagination.size)),
        has_next=pagination.page < max(1, -(-total // pagination.size)),
        has_prev=pagination.page > 1,
    )


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    svc: Svc, body: ConversationCreate, current_user: AuthUser
) -> ConversationResponse:
    # Always inject tenant; customers always own their conversation; agents can specify user_id
    body.tenant_id = current_user.tenant_id
    if current_user.role == "customer" or body.user_id is None:
        body.user_id = current_user.id
    conv = await svc.create(body)

    # Notify agents in real-time of the new conversation
    from app.core.connection_manager import manager
    from app.routers.websocket import _conv_to_dict
    await manager.broadcast_to_tenant(
        str(current_user.tenant_id),
        {"type": "conversation_new", "data": _conv_to_dict(conv)},
    )

    return ConversationResponse.model_validate(conv)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    svc: Svc, conversation_id: uuid.UUID, current_user: AuthUser
) -> ConversationResponse:
    conv = await svc.get(conversation_id)
    verify_conversation_access(conv, current_user)
    return ConversationResponse.model_validate(conv)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    svc: Svc, conversation_id: uuid.UUID, body: ConversationUpdate,
    current_user: Annotated[User, Depends(require_agent())],
) -> ConversationResponse:
    conv = await svc.get(conversation_id)
    verify_tenant_access(conv.tenant_id, current_user)
    conv = await svc.update(conversation_id, body)
    return ConversationResponse.model_validate(conv)


@router.post("/{conversation_id}/resolve", response_model=ConversationResponse)
async def resolve_conversation(
    svc: Svc, conversation_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_agent())],
) -> ConversationResponse:
    conv = await svc.get(conversation_id)
    verify_tenant_access(conv.tenant_id, current_user)
    conv = await svc.resolve(conversation_id)
    return ConversationResponse.model_validate(conv)


@router.post("/{conversation_id}/escalate", response_model=ConversationResponse)
async def escalate_conversation(
    svc: Svc, conversation_id: uuid.UUID, body: EscalateRequest, current_user: AuthUser
) -> ConversationResponse:
    conv = await svc.get(conversation_id)
    verify_conversation_access(conv, current_user)
    conv = await svc.escalate(conversation_id, body)
    return ConversationResponse.model_validate(conv)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_conversation(
    svc: Svc, conversation_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_agent())],
) -> Response:
    conv = await svc.get(conversation_id)
    verify_tenant_access(conv.tenant_id, current_user)
    await svc.soft_delete(conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
