from __future__ import annotations
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_agent
from app.core.database import get_db
from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.user import User
from app.schemas.intent import IntentCreate, IntentResponse, IntentUpdate
from app.services.intent_service import IntentService

router = APIRouter(prefix="/intents", tags=["Intents"])


def _svc(db: AsyncSession = Depends(get_db)) -> IntentService:
    return IntentService(db)


Svc = Annotated[IntentService, Depends(_svc)]
Pagination = Annotated[PaginationParams, Depends()]
AuthUser = Annotated[User, Depends(get_current_user)]
AgentUser = Annotated[User, Depends(require_agent())]


@router.get("", response_model=PaginatedResponse[IntentResponse])
async def list_intents(
    svc: Svc,
    pagination: Pagination,
    current_user: AuthUser,
    is_active: bool | None = Query(None),
) -> PaginatedResponse[IntentResponse]:
    items, total = await svc.list(
        tenant_id=current_user.tenant_id,
        is_active=is_active,
        page=pagination.page,
        size=pagination.size,
    )
    return PaginatedResponse(
        items=[IntentResponse.model_validate(i) for i in items],
        total=total,
        page=pagination.page,
        size=pagination.size,
        pages=max(1, -(-total // pagination.size)),
        has_next=pagination.page < max(1, -(-total // pagination.size)),
        has_prev=pagination.page > 1,
    )


@router.post("", response_model=IntentResponse, status_code=status.HTTP_201_CREATED)
async def create_intent(
    svc: Svc, body: IntentCreate, current_user: AgentUser
) -> IntentResponse:
    body.tenant_id = current_user.tenant_id
    intent = await svc.create(body)
    return IntentResponse.model_validate(intent)


@router.get("/{intent_id}", response_model=IntentResponse)
async def get_intent(
    svc: Svc, intent_id: uuid.UUID, current_user: AuthUser
) -> IntentResponse:
    intent = await svc.get(intent_id)
    return IntentResponse.model_validate(intent)


@router.patch("/{intent_id}", response_model=IntentResponse)
async def update_intent(
    svc: Svc, intent_id: uuid.UUID, body: IntentUpdate, current_user: AgentUser
) -> IntentResponse:
    intent = await svc.update(intent_id, body)
    return IntentResponse.model_validate(intent)


@router.delete("/{intent_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_intent(
    svc: Svc, intent_id: uuid.UUID, current_user: AgentUser
) -> Response:
    await svc.delete(intent_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
