"""WebSocket endpoint for real-time chat.

Protocol (all frames are JSON):
  Client → Server:
    {"type":"authenticate","token":"<JWT>"}
    {"type":"join","conversation_id":"<uuid>"}
    {"type":"leave","conversation_id":"<uuid>"}
    {"type":"message","conversation_id":"<uuid>","content":"...","temp_id":"<str>"}
    {"type":"typing_start","conversation_id":"<uuid>"}
    {"type":"typing_stop","conversation_id":"<uuid>"}
    {"type":"read","message_id":"<uuid>"}
    {"type":"ping"}

  Server → Client:
    {"type":"authenticated","user_id":"...","role":"...","online_users":["..."]}
    {"type":"joined","conversation_id":"...","messages":[...]}
    {"type":"message","data":{...},"temp_id":"..."}
    {"type":"bot_message","data":{...}}
    {"type":"typing","conversation_id":"...","user_id":"...","name":"...","is_typing":true}
    {"type":"presence","user_id":"...","name":"...","status":"online|offline"}
    {"type":"message_status","message_id":"...","status":"delivered|read","conversation_id":"..."}
    {"type":"conversation_update","data":{...}}
    {"type":"conversation_new","data":{...}}
    {"type":"error","message":"...","code":"..."}
    {"type":"pong"}
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import update

from app.core.connection_manager import manager
from app.core.database import AsyncSessionLocal
from app.core.redis_client import get_redis
from app.core.security import decode_access_token
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import AGENT_ROLES
from app.services import bot_service
from app.services.message_service import MessageService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["WebSocket"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _msg_to_dict(msg: Message) -> dict:
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "sender_id": str(msg.sender_id) if msg.sender_id else None,
        "content": msg.content,
        "is_bot": msg.is_bot,
        "status": msg.status,
        "intent": msg.intent,
        "sentiment": msg.sentiment,
        "entities": msg.entities,
        "created_at": msg.created_at.isoformat(),
    }


def _conv_to_dict(conv: Conversation) -> dict:
    return {
        "id": str(conv.id),
        "tenant_id": str(conv.tenant_id),
        "user_id": str(conv.user_id),
        "assigned_agent_id": str(conv.assigned_agent_id) if conv.assigned_agent_id else None,
        "status": conv.status,
        "channel": conv.channel,
        "title": conv.title,
        "message_count": conv.message_count,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    }


async def _send_error(ws: WebSocket, message: str, code: str = "error") -> None:
    try:
        await ws.send_json({"type": "error", "message": message, "code": code})
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Message handlers
# ---------------------------------------------------------------------------

async def _handle_join(
    ws: WebSocket,
    data: dict,
    user_id: str,
    tenant_id: str,
    user_role: str,
) -> None:
    conv_id_raw = data.get("conversation_id")
    if not conv_id_raw:
        await _send_error(ws, "conversation_id required")
        return

    try:
        conv_uuid = uuid.UUID(str(conv_id_raw))
    except ValueError:
        await _send_error(ws, "invalid conversation_id")
        return

    async with AsyncSessionLocal() as db:
        conv = await db.get(Conversation, conv_uuid)
        if not conv or conv.is_deleted:
            await _send_error(ws, "Conversation not found", "not_found")
            return

        # Access check: customer can only join their own conversation;
        # agents can join any conversation in their tenant
        if str(conv.tenant_id) != tenant_id:
            await _send_error(ws, "Forbidden", "forbidden")
            return
        if user_role == "customer" and str(conv.user_id) != user_id:
            await _send_error(ws, "Forbidden", "forbidden")
            return

        manager.join_conversation(user_id, str(conv_uuid))

        # Load recent messages (last 50)
        svc = MessageService(db)
        messages, _ = await svc.list_for_conversation(conv_uuid, page=1, size=50)

        online_in_conv = [
            uid for uid in manager.get_conv_members(str(conv_uuid))
            if manager.is_online(uid)
        ]

        await ws.send_json({
            "type": "joined",
            "conversation_id": str(conv_uuid),
            "conversation": _conv_to_dict(conv),
            "messages": [_msg_to_dict(m) for m in messages],
            "online_users": online_in_conv,
        })

        # Mark messages as delivered for this user
        await db.execute(
            update(Message)
            .where(
                Message.conversation_id == conv_uuid,
                Message.sender_id != uuid.UUID(user_id),
                Message.status == "sent",
            )
            .values(status="delivered")
        )

        # Notify others in conv that messages are delivered
        await manager.broadcast_to_conversation(
            str(conv_uuid),
            {"type": "messages_delivered", "conversation_id": str(conv_uuid), "by_user_id": user_id},
            exclude_user_id=user_id,
        )


async def _handle_leave(ws: WebSocket, data: dict, user_id: str) -> None:
    conv_id = data.get("conversation_id", "")
    manager.leave_conversation(user_id, conv_id)
    await ws.send_json({"type": "left", "conversation_id": conv_id})


async def _handle_message(
    ws: WebSocket,
    data: dict,
    user_id: str,
    tenant_id: str,
    user_name: str,
    user_role: str,
) -> None:
    conv_id_raw = data.get("conversation_id")
    content = (data.get("content") or "").strip()
    temp_id = data.get("temp_id", "")

    if not conv_id_raw or not content:
        await _send_error(ws, "conversation_id and content required")
        return

    try:
        conv_uuid = uuid.UUID(str(conv_id_raw))
    except ValueError:
        await _send_error(ws, "invalid conversation_id")
        return

    async with AsyncSessionLocal() as db:
        conv = await db.get(Conversation, conv_uuid)
        if not conv or conv.is_deleted:
            await _send_error(ws, "Conversation not found", "not_found")
            return
        if str(conv.tenant_id) != tenant_id:
            await _send_error(ws, "Forbidden", "forbidden")
            return
        if conv.status in ("resolved", "closed"):
            await _send_error(ws, "Conversation is closed", "closed")
            return

        # Persist user message
        msg = Message(
            conversation_id=conv_uuid,
            sender_id=uuid.UUID(user_id),
            content=content,
            is_bot=False,
            status="sent",
        )
        db.add(msg)
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conv_uuid)
            .values(message_count=Conversation.message_count + 1, updated_at=_now())
        )
        await db.flush()
        await db.refresh(msg)

        msg_id = msg.id
        msg_data = _msg_to_dict(msg)
        # Collect recent history for LLM context (last 10 messages)
        svc = MessageService(db)
        history_msgs, _ = await svc.list_for_conversation(conv_uuid, page=1, size=10)
        history = [
            {"content": m.content, "is_bot": m.is_bot}
            for m in history_msgs
            if m.id != msg_id
        ]
        await db.commit()

    # Broadcast user message to all conversation members
    await manager.broadcast_to_conversation(
        str(conv_uuid),
        {"type": "message", "data": msg_data, "temp_id": temp_id},
    )

    # Notify agents in tenant of new activity
    await manager.broadcast_to_tenant(
        tenant_id,
        {"type": "conversation_activity", "conversation_id": str(conv_uuid), "tenant_id": tenant_id},
    )

    # Generate bot reply only if no agent is in the conversation
    conv_members = manager.get_conv_members(str(conv_uuid))
    agent_in_conv = any(
        uid != user_id and manager.is_online(uid)
        for uid in conv_members
    )

    if not agent_in_conv or user_role in AGENT_ROLES:
        # Only auto-reply when customer is speaking and no agent has joined
        if user_role == "customer":
            asyncio.create_task(
                _send_bot_reply(conv_uuid, content, tenant_id, user_msg_id=msg_id, history=history)
            )


async def _send_bot_reply(
    conv_uuid: uuid.UUID,
    user_content: str,
    tenant_id: str,
    user_msg_id: uuid.UUID | None = None,
    history: list[dict] | None = None,
) -> None:
    """Run AI pipeline, persist bot reply + analysis, then broadcast."""
    redis = get_redis()
    log.info("bot_reply.start", conv_id=str(conv_uuid))

    try:
        async with AsyncSessionLocal() as db:
            # Run full AI pipeline — returns AnalysisResult
            result = await bot_service.process_message(
                content=user_content,
                conversation_id=str(conv_uuid),
                db=db,
                tenant_id=tenant_id,
                redis=redis,
                history=history,
            )

            # Persist analysis fields back onto the user message
            if user_msg_id:
                await db.execute(
                    update(Message)
                    .where(Message.id == user_msg_id)
                    .values(
                        intent=result.intent,
                        intent_confidence=result.intent_confidence if result.intent else None,
                        sentiment=result.sentiment,
                        sentiment_score=result.sentiment_score,
                        entities=result.entities,
                        knowledge_article_ids=[a["id"] for a in result.knowledge_articles],
                    )
                )

            # Persist bot reply
            bot_msg = Message(
                conversation_id=conv_uuid,
                sender_id=None,
                content=result.response,
                is_bot=True,
                status="sent",
            )
            db.add(bot_msg)
            await db.execute(
                update(Conversation)
                .where(Conversation.id == conv_uuid)
                .values(message_count=Conversation.message_count + 1, updated_at=_now())
            )
            await db.flush()
            await db.refresh(bot_msg)
            bot_data = _msg_to_dict(bot_msg)
            await db.commit()

        # Broadcast bot reply
        await manager.broadcast_to_conversation(
            str(conv_uuid),
            {"type": "bot_message", "data": bot_data},
        )

        # Broadcast analysis to the conversation room (frontend uses this for badges)
        if user_msg_id:
            await manager.broadcast_to_conversation(
                str(conv_uuid),
                {
                    "type": "message_analysis",
                    "message_id": str(user_msg_id),
                    "data": result.to_frontend_dict(),
                },
            )

        # Auto-escalation signal to agents
        if result.escalation_recommended:
            await manager.broadcast_to_tenant(
                tenant_id,
                {
                    "type": "escalation_suggested",
                    "conversation_id": str(conv_uuid),
                    "sentiment_score": result.sentiment_score,
                },
            )

        log.info("bot_reply.done", conv_id=str(conv_uuid), fallback=result.fallback_used)

    except Exception as exc:
        log.error("bot_reply.error", conv_id=str(conv_uuid), error=str(exc))


async def _handle_typing(
    ws: WebSocket,
    data: dict,
    user_id: str,
    user_name: str,
    is_typing: bool,
) -> None:
    conv_id = data.get("conversation_id", "")
    if not conv_id:
        return
    # Only members who actually joined this conversation (via _handle_join,
    # which enforces tenant + ownership) may broadcast typing into it.
    if user_id not in manager.get_conv_members(conv_id):
        return
    await manager.broadcast_to_conversation(
        conv_id,
        {
            "type": "typing",
            "conversation_id": conv_id,
            "user_id": user_id,
            "name": user_name,
            "is_typing": is_typing,
        },
        exclude_user_id=user_id,
    )


async def _handle_read(ws: WebSocket, data: dict, user_id: str, tenant_id: str) -> None:
    message_id_raw = data.get("message_id")
    if not message_id_raw:
        return
    try:
        msg_uuid = uuid.UUID(str(message_id_raw))
    except ValueError:
        return

    async with AsyncSessionLocal() as db:
        msg = await db.get(Message, msg_uuid)
        if not msg:
            return

        conv = await db.get(Conversation, msg.conversation_id)
        if not conv or str(conv.tenant_id) != tenant_id:
            return

        await db.execute(
            update(Message).where(Message.id == msg_uuid).values(status="read")
        )

        # Notify the original sender
        await manager.broadcast_to_conversation(
            str(msg.conversation_id),
            {
                "type": "message_status",
                "message_id": str(msg_uuid),
                "status": "read",
                "conversation_id": str(msg.conversation_id),
                "by_user_id": user_id,
            },
        )


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.websocket("/api/v1/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()

    user_id: str | None = None
    tenant_id: str | None = None
    user_name: str = "User"
    user_role: str = "customer"

    try:
        # ---- Authentication (first frame must be authenticate) ----
        try:
            raw = await asyncio.wait_for(ws.receive_json(), timeout=15.0)
        except asyncio.TimeoutError:
            await _send_error(ws, "Authentication timeout", "auth_timeout")
            await ws.close(code=4001)
            return

        if raw.get("type") != "authenticate":
            await _send_error(ws, "First message must be authenticate", "auth_required")
            await ws.close(code=4001)
            return

        token = raw.get("token", "")
        try:
            payload = decode_access_token(token)
        except Exception:
            await _send_error(ws, "Invalid or expired token", "invalid_token")
            await ws.close(code=4001)
            return

        user_id = payload["sub"]
        tenant_id = payload["tenant_id"]
        user_role = payload.get("role", "customer")

        # Load user record to get name + verify still active
        async with AsyncSessionLocal() as db:
            from app.models.user import User
            user = await db.get(User, uuid.UUID(user_id))
            if not user or not user.is_active:
                await _send_error(ws, "User not found or inactive", "forbidden")
                await ws.close(code=4003)
                return
            user_name = user.name or user.email

        # Register connection
        await manager.connect(ws, user_id, tenant_id)
        log.info("ws.connected", user_id=user_id, role=user_role)

        online_users = manager.get_online_users(tenant_id)

        await ws.send_json({
            "type": "authenticated",
            "user_id": user_id,
            "role": user_role,
            "online_users": online_users,
        })

        # Broadcast presence to tenant
        await manager.broadcast_to_tenant(
            tenant_id,
            {"type": "presence", "user_id": user_id, "name": user_name, "status": "online"},
        )

        # ---- Main message loop ----
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_json(), timeout=90.0)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
                continue

            msg_type = data.get("type", "")

            if msg_type == "join":
                await _handle_join(ws, data, user_id, tenant_id, user_role)

            elif msg_type == "leave":
                await _handle_leave(ws, data, user_id)

            elif msg_type == "message":
                await _handle_message(ws, data, user_id, tenant_id, user_name, user_role)

            elif msg_type == "typing_start":
                await _handle_typing(ws, data, user_id, user_name, True)

            elif msg_type == "typing_stop":
                await _handle_typing(ws, data, user_id, user_name, False)

            elif msg_type == "read":
                await _handle_read(ws, data, user_id, tenant_id)

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

            else:
                await _send_error(ws, f"Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        log.info("ws.disconnected", user_id=user_id)
    except Exception as exc:
        log.error("ws.error", user_id=user_id, error=str(exc))
    finally:
        if user_id and tenant_id:
            await manager.disconnect(ws, user_id, tenant_id)
            await manager.broadcast_to_tenant(
                tenant_id,
                {"type": "presence", "user_id": user_id, "name": user_name, "status": "offline"},
            )
            log.info("ws.cleaned_up", user_id=user_id)
