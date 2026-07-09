"""WhatsApp Business API (Meta Cloud API) integration.

Inbound flow:
  Meta → POST /api/v1/webhooks/whatsapp → AI pipeline → WhatsApp reply

Setup:
  1. In Meta for Developers, create a WhatsApp Business App.
  2. Set the webhook URL to https://your-domain.com/api/v1/webhooks/whatsapp
  3. Set the verify token to the value of WHATSAPP_VERIFY_TOKEN in your env.
  4. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your env.
  5. Subscribe to the 'messages' webhook field.

Env vars (add to services/api/.env):
  WHATSAPP_VERIFY_TOKEN=<a secret string you choose>
  WHATSAPP_ACCESS_TOKEN=<permanent system user token from Meta>
  WHATSAPP_PHONE_NUMBER_ID=<your WhatsApp phone number ID>
"""
import hashlib
import hmac
import json
import uuid

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, Header, Query, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.tenant import Tenant
from app.services import bot_service

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhooks/whatsapp", tags=["WhatsApp"])

# ---------------------------------------------------------------------------
# Webhook verification (GET) — Meta sends this once when you register the URL
# ---------------------------------------------------------------------------

@router.get("", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
) -> str:
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        log.info("whatsapp.webhook.verified")
        return hub_challenge
    return PlainTextResponse("Forbidden", status_code=status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# Inbound messages (POST)
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_200_OK)
async def receive_message(
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_hub_signature_256: str = Header(default="", alias="x-hub-signature-256"),
) -> JSONResponse:
    body = await request.body()

    # Verify Meta's HMAC-SHA256 signature
    if settings.whatsapp_app_secret:
        expected = "sha256=" + hmac.new(
            settings.whatsapp_app_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_hub_signature_256):
            log.warning("whatsapp.signature.invalid")
            return JSONResponse({"error": "invalid signature"}, status_code=403)

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return JSONResponse({"error": "invalid JSON"}, status_code=400)

    # Meta sends batches; iterate through all entries
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            for msg in messages:
                if msg.get("type") != "text":
                    continue  # skip media/sticker/etc for now
                background.add_task(
                    _handle_inbound,
                    wa_message_id=msg["id"],
                    from_number=msg["from"],
                    text=msg["text"]["body"],
                    db=db,
                )

    # Meta requires a 200 immediately — processing happens in background
    return JSONResponse({"status": "ok"})


# ---------------------------------------------------------------------------
# Background handler — run AI pipeline then reply via WhatsApp
# ---------------------------------------------------------------------------

async def _handle_inbound(
    wa_message_id: str,
    from_number: str,
    text: str,
    db: AsyncSession,
) -> None:
    try:
        # Find or create a conversation keyed on phone number
        # We use the default tenant (first active tenant) when no tenant mapping exists.
        # For multi-tenant setups, map phone numbers to tenants via a dedicated table.
        tenant = await _get_default_tenant(db)
        if tenant is None:
            log.warning("whatsapp.no_tenant_found")
            return

        conv = await _get_or_create_conversation(from_number, tenant.id, db)

        # Persist user message
        user_msg = Message(
            conversation_id=conv.id,
            content=text,
            is_bot=False,
            status="delivered",
        )
        db.add(user_msg)
        await db.flush()

        # Run AI pipeline
        result = await bot_service.process_message(
            content=text,
            conversation_id=str(conv.id),
            db=db,
            tenant_id=str(tenant.id),
        )

        # Persist bot response
        bot_msg = Message(
            conversation_id=conv.id,
            content=result.response,
            is_bot=True,
            status="sent",
            intent=result.intent,
            intent_confidence=result.intent_confidence,
            sentiment=result.sentiment,
            sentiment_score=result.sentiment_score,
        )
        db.add(bot_msg)
        await db.commit()

        # Send reply via WhatsApp Cloud API
        await _send_whatsapp_message(to=from_number, text=result.response)

        log.info("whatsapp.reply.sent", to=from_number, conversation_id=str(conv.id))

    except Exception as exc:
        log.error("whatsapp.handler.error", error=str(exc))
        await db.rollback()


async def _get_default_tenant(db: AsyncSession) -> Tenant | None:
    from sqlalchemy import select
    result = await db.execute(
        select(Tenant).where(Tenant.is_active.is_(True)).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_or_create_conversation(
    from_number: str, tenant_id: uuid.UUID, db: AsyncSession
) -> Conversation:
    """Return the open WhatsApp conversation for this phone number, or create one."""
    from sqlalchemy import select
    from app.models.user import User

    # Find or create a guest user for this phone number
    guest_email = f"wa_{from_number}@whatsapp.supportiq"
    result = await db.execute(select(User).where(User.email == guest_email))
    guest = result.scalar_one_or_none()
    if guest is None:
        guest = User(
            tenant_id=tenant_id,
            email=guest_email,
            name=f"+{from_number}",
            role="customer",
            password_hash="",
            is_active=True,
            email_verified=True,
        )
        db.add(guest)
        await db.flush()

    # Find open conversation for this guest
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.tenant_id == tenant_id,
            Conversation.user_id == guest.id,
            Conversation.channel == "whatsapp",
            Conversation.status == "open",
            Conversation.deleted_at.is_(None),
        ).limit(1)
    )
    conv = conv_result.scalar_one_or_none()
    if conv is None:
        conv = Conversation(
            tenant_id=tenant_id,
            user_id=guest.id,
            channel="whatsapp",
            title=f"WhatsApp — +{from_number}",
            status="open",
        )
        db.add(conv)
        await db.flush()

    return conv


async def _send_whatsapp_message(to: str, text: str) -> None:
    """Send a text reply via the WhatsApp Cloud API."""
    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        log.warning("whatsapp.send.skipped — credentials not configured")
        return

    url = f"https://graph.facebook.com/v20.0/{settings.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {settings.whatsapp_access_token}"},
        )
        if res.status_code >= 400:
            log.error("whatsapp.send.failed", status=res.status_code, body=res.text)
