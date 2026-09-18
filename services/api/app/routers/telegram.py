"""Telegram Bot API integration.

Inbound flow:
  Telegram → POST /api/v1/webhooks/telegram → AI pipeline → Telegram reply

Setup:
  1. Create a bot via @BotFather and grab its token.
  2. Choose a secret token string (anything random) for TELEGRAM_WEBHOOK_SECRET.
  3. Register the webhook with Telegram by calling:
       https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
         ?url=https://your-domain.com/api/v1/webhooks/telegram
         &secret_token=<TELEGRAM_WEBHOOK_SECRET>
  4. Telegram will echo secret_token back on every webhook POST via the
     X-Telegram-Bot-Api-Secret-Token header — we verify it below.

Env vars (add to services/api/.env):
  TELEGRAM_BOT_TOKEN=<token from @BotFather>
  TELEGRAM_WEBHOOK_SECRET=<a secret string you choose>
"""
import hmac
import json
import uuid

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.tenant import Tenant
from app.services import bot_service
from app.services.tenant_settings_service import TenantSettingsService

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhooks/telegram", tags=["Telegram"])


# ---------------------------------------------------------------------------
# Inbound updates (POST)
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_200_OK)
async def receive_update(
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_telegram_bot_api_secret_token: str = Header(
        default="", alias="x-telegram-bot-api-secret-token"
    ),
) -> JSONResponse:
    body = await request.body()

    # Verify Telegram's shared secret token. Telegram echoes back whatever
    # secret_token we supplied when calling setWebhook, on every request —
    # a direct shared-secret comparison, not an HMAC over the body like
    # WhatsApp's X-Hub-Signature-256. We fail closed here as defense in depth.
    if settings.telegram_webhook_secret:
        if not hmac.compare_digest(
            x_telegram_bot_api_secret_token, settings.telegram_webhook_secret
        ):
            log.warning("telegram.secret.invalid")
            return JSONResponse({"error": "invalid secret token"}, status_code=403)
    elif settings.is_production:
        log.error("telegram.webhook.rejected — TELEGRAM_WEBHOOK_SECRET not configured")
        return JSONResponse({"error": "webhook not configured"}, status_code=503)
    else:
        log.warning("telegram.secret.skipped — TELEGRAM_WEBHOOK_SECRET not set (dev only)")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return JSONResponse({"error": "invalid JSON"}, status_code=400)

    message = payload.get("message", {})
    text = message.get("text")
    chat = message.get("chat", {})
    chat_id = chat.get("id")

    if text is None or chat_id is None:
        # Skip non-text updates (photos, stickers, edited messages, etc) for now
        return JSONResponse({"status": "ok"})

    background.add_task(
        _handle_inbound,
        chat_id=chat_id,
        text=text,
        db=db,
    )

    # Telegram requires a fast 200 — processing happens in background
    return JSONResponse({"status": "ok"})


# ---------------------------------------------------------------------------
# Background handler — run AI pipeline then reply via Telegram
# ---------------------------------------------------------------------------

async def _handle_inbound(
    chat_id: int,
    text: str,
    db: AsyncSession,
) -> None:
    try:
        # Find or create a conversation keyed on Telegram chat id
        # We use the default tenant (first active tenant) when no tenant mapping exists.
        # For multi-tenant setups, map chat ids to tenants via a dedicated table.
        tenant = await _get_default_tenant(db)
        if tenant is None:
            log.warning("telegram.no_tenant_found")
            return

        tenant_settings = await TenantSettingsService(db).get_or_create(tenant.id)
        if not tenant_settings.telegram_enabled:
            log.info("telegram.disabled_for_tenant", tenant_id=str(tenant.id))
            return

        conv = await _get_or_create_conversation(chat_id, tenant.id, db)

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

        # Send reply via Telegram Bot API
        await _send_telegram_message(chat_id=chat_id, text=result.response)

        log.info("telegram.reply.sent", chat_id=chat_id, conversation_id=str(conv.id))

    except Exception as exc:
        log.error("telegram.handler.error", error=str(exc))
        await db.rollback()


async def _get_default_tenant(db: AsyncSession) -> Tenant | None:
    from sqlalchemy import select
    result = await db.execute(
        select(Tenant).where(Tenant.is_active.is_(True)).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_or_create_conversation(
    chat_id: int, tenant_id: uuid.UUID, db: AsyncSession
) -> Conversation:
    """Return the open Telegram conversation for this chat id, or create one."""
    from sqlalchemy import select
    from app.models.user import User

    # Find or create a guest user for this chat id
    guest_email = f"tg_{chat_id}@telegram.teedesk"
    result = await db.execute(select(User).where(User.email == guest_email))
    guest = result.scalar_one_or_none()
    if guest is None:
        guest = User(
            tenant_id=tenant_id,
            email=guest_email,
            name=f"Telegram {chat_id}",
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
            Conversation.channel == "telegram",
            Conversation.status == "open",
            Conversation.deleted_at.is_(None),
        ).limit(1)
    )
    conv = conv_result.scalar_one_or_none()
    if conv is None:
        conv = Conversation(
            tenant_id=tenant_id,
            user_id=guest.id,
            channel="telegram",
            title=f"Telegram — {chat_id}",
            status="open",
        )
        db.add(conv)
        await db.flush()

    return conv


async def _send_telegram_message(chat_id: int, text: str) -> None:
    """Send a text reply via the Telegram Bot API."""
    if not settings.telegram_bot_token:
        log.warning("telegram.send.skipped — credentials not configured")
        return

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(url, json=payload)
        if res.status_code >= 400:
            log.error("telegram.send.failed", status=res.status_code, body=res.text)
