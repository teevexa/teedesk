"""Escalation endpoints — list, claim, and resolve agent handoffs."""
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_agent, require_admin, verify_tenant_access
from app.core.database import get_db
from app.core.exceptions import NotFoundException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.conversation import Conversation
from app.models.escalation import Escalation
from app.models.user import User
from app.schemas.escalation import EscalationResponse, EscalationUpdate

router = APIRouter(prefix="/escalations", tags=["Escalations"])

AuthAgent = Annotated[User, Depends(require_agent())]
Pagination = Annotated[PaginationParams, Depends()]


async def _get_escalation(esc_id: uuid.UUID, db: AsyncSession) -> Escalation:
    result = await db.execute(select(Escalation).where(Escalation.id == esc_id))
    esc = result.scalar_one_or_none()
    if esc is None:
        raise NotFoundException(f"Escalation {esc_id} not found")
    return esc


@router.get("", response_model=PaginatedResponse[EscalationResponse])
async def list_escalations(
    current_user: AuthAgent,
    db: AsyncSession = Depends(get_db),
    pagination: Pagination = ...,
    resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
    assigned_to_me: bool = Query(False),
) -> PaginatedResponse[EscalationResponse]:
    stmt = (
        select(Escalation)
        .join(Conversation, Escalation.conversation_id == Conversation.id)
        .where(Conversation.tenant_id == current_user.tenant_id)
    )

    if resolved is False or resolved is None:
        stmt = stmt.where(Escalation.resolved_at.is_(None))
    elif resolved is True:
        stmt = stmt.where(Escalation.resolved_at.is_not(None))

    if assigned_to_me:
        stmt = stmt.where(Escalation.assigned_agent_id == current_user.id)

    count_stmt = select(Escalation.id).join(
        Conversation, Escalation.conversation_id == Conversation.id
    ).where(Conversation.tenant_id == current_user.tenant_id)
    if resolved is False or resolved is None:
        count_stmt = count_stmt.where(Escalation.resolved_at.is_(None))
    elif resolved is True:
        count_stmt = count_stmt.where(Escalation.resolved_at.is_not(None))
    if assigned_to_me:
        count_stmt = count_stmt.where(Escalation.assigned_agent_id == current_user.id)

    total_result = await db.execute(count_stmt)
    total = len(total_result.all())

    stmt = stmt.order_by(Escalation.created_at.desc()).offset(
        (pagination.page - 1) * pagination.size
    ).limit(pagination.size)

    result = await db.execute(stmt)
    items = result.scalars().all()
    pages = max(1, -(-total // pagination.size))

    return PaginatedResponse(
        items=[EscalationResponse.model_validate(e) for e in items],
        total=total,
        page=pagination.page,
        size=pagination.size,
        pages=pages,
        has_next=pagination.page < pages,
        has_prev=pagination.page > 1,
    )


@router.get("/{escalation_id}", response_model=EscalationResponse)
async def get_escalation(
    escalation_id: uuid.UUID,
    current_user: AuthAgent,
    db: AsyncSession = Depends(get_db),
) -> EscalationResponse:
    esc = await _get_escalation(escalation_id, db)
    conv = await db.get(Conversation, esc.conversation_id)
    if conv:
        verify_tenant_access(conv.tenant_id, current_user)
    return EscalationResponse.model_validate(esc)


@router.post("/{escalation_id}/claim", response_model=EscalationResponse)
async def claim_escalation(
    escalation_id: uuid.UUID,
    current_user: AuthAgent,
    db: AsyncSession = Depends(get_db),
) -> EscalationResponse:
    """Agent claims ownership of an unresolved escalation."""
    esc = await _get_escalation(escalation_id, db)
    conv = await db.get(Conversation, esc.conversation_id)
    if conv:
        verify_tenant_access(conv.tenant_id, current_user)

    await db.execute(
        update(Escalation)
        .where(Escalation.id == escalation_id)
        .values(assigned_agent_id=current_user.id)
    )
    # Also assign the conversation
    if conv:
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conv.id)
            .values(assigned_agent_id=current_user.id)
        )
    await db.commit()
    await db.refresh(esc)

    # Notify tenant via WebSocket
    try:
        from app.core.connection_manager import manager
        await manager.broadcast_to_tenant(
            str(current_user.tenant_id),
            {
                "type": "escalation_claimed",
                "escalation_id": str(escalation_id),
                "agent_id": str(current_user.id),
                "conversation_id": str(esc.conversation_id),
            },
        )
    except Exception:
        pass

    return EscalationResponse.model_validate(esc)


@router.post("/{escalation_id}/resolve", response_model=EscalationResponse)
async def resolve_escalation(
    escalation_id: uuid.UUID,
    body: EscalationUpdate,
    current_user: AuthAgent,
    db: AsyncSession = Depends(get_db),
) -> EscalationResponse:
    """Agent marks an escalation as resolved."""
    esc = await _get_escalation(escalation_id, db)
    conv = await db.get(Conversation, esc.conversation_id)
    if conv:
        verify_tenant_access(conv.tenant_id, current_user)

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Escalation)
        .where(Escalation.id == escalation_id)
        .values(
            resolved_at=now,
            resolution_notes=body.resolution_notes,
            assigned_agent_id=body.assigned_agent_id or esc.assigned_agent_id or current_user.id,
        )
    )
    # Mark conversation resolved too
    if conv and conv.status == "escalated":
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conv.id)
            .values(status="resolved", resolved_at=now)
        )
    await db.commit()
    await db.refresh(esc)

    try:
        from app.core.connection_manager import manager
        await manager.broadcast_to_tenant(
            str(current_user.tenant_id),
            {
                "type": "escalation_resolved",
                "escalation_id": str(escalation_id),
                "agent_id": str(current_user.id),
                "conversation_id": str(esc.conversation_id),
            },
        )
    except Exception:
        pass

    return EscalationResponse.model_validate(esc)


@router.delete("/{escalation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_escalation(
    escalation_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin())],
    db: AsyncSession = Depends(get_db),
) -> Response:
    esc = await _get_escalation(escalation_id, db)
    conv = await db.get(Conversation, esc.conversation_id)
    if conv:
        verify_tenant_access(conv.tenant_id, current_user)
    await db.delete(esc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
