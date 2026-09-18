"""Widget endpoints — guest session creation for the embeddable chat widget."""
import uuid
from datetime import timedelta

import structlog
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.rate_limit import STRICT_LIMIT, limiter
from app.core.security import create_access_token
from app.models.conversation import Conversation
from app.models.tenant import Tenant
from app.models.user import User

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/widget", tags=["Widget"])


class SessionRequest(BaseModel):
    tenant_id: str


class SessionResponse(BaseModel):
    access_token: str
    conversation_id: str
    tenant_name: str


@router.post("/session", response_model=SessionResponse)
@limiter.limit(STRICT_LIMIT)
async def create_guest_session(
    request: Request,
    body: SessionRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Issue a short-lived guest JWT and a fresh conversation for the widget.

    Called by the embeddable widget on first open.  No authentication required —
    the tenant_id in the script tag acts as the public identifier.
    """
    try:
        tenant_uuid = uuid.UUID(body.tenant_id)
    except ValueError:
        raise BadRequestException("Invalid tenant_id")

    # Validate tenant exists and is active
    tenant_result = await db.execute(
        select(Tenant).where(
            Tenant.id == tenant_uuid,
            Tenant.is_active.is_(True),
        )
    )
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise NotFoundException("Tenant not found or inactive")

    # Create an anonymous guest user record (or reuse an existing bot-user pattern)
    guest_id = uuid.uuid4()
    guest_email = f"guest_{guest_id.hex[:8]}@widget.teedesk"
    guest = User(
        id=guest_id,
        tenant_id=tenant.id,
        email=guest_email,
        name="Visitor",
        role="customer",
        password_hash="",        # guests cannot log in via password
        is_active=True,
        email_verified=True,
    )
    db.add(guest)
    await db.flush()

    # Create a fresh conversation for this session
    conv = Conversation(
        tenant_id=tenant.id,
        user_id=guest.id,
        channel="web",
        title="Widget conversation",
        status="open",
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    # Issue a short-lived JWT (30 minutes — widget sessions are ephemeral)
    token = create_access_token(
        subject=str(guest.id),
        tenant_id=str(tenant.id),
        role="customer",
        expires_delta=timedelta(minutes=30),
    )

    log.info("widget.session.created", tenant_id=str(tenant.id), conversation_id=str(conv.id))

    return SessionResponse(
        access_token=token,
        conversation_id=str(conv.id),
        tenant_name=tenant.name,
    )
