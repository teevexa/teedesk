"""WebSocket connection manager.

In-process registry for a single server instance.
Redis pub/sub is used for cross-process broadcast so this scales
horizontally when multiple uvicorn workers are deployed.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)

# Channel prefixes for Redis pub/sub
_CHAN_CONV = "siq:conv:"      # siq:conv:{conversation_id}
_CHAN_TENANT = "siq:tenant:"  # siq:tenant:{tenant_id}

# Unique identifier for this process — used to avoid re-delivering our own pub/sub messages
_INSTANCE_ID = os.urandom(8).hex()


class ConnectionManager:
    def __init__(self) -> None:
        # user_id -> list[WebSocket]  (one user can open multiple tabs)
        self._user_sockets: dict[str, list[WebSocket]] = defaultdict(list)

        # conversation_id -> set of user_ids currently joined
        self._conv_members: dict[str, set[str]] = defaultdict(set)

        # tenant_id -> set of user_ids that are online
        self._tenant_online: dict[str, set[str]] = defaultdict(set)

        # Redis subscriber task (started on app startup)
        self._subscriber_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._redis: Any = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self, redis: Any) -> None:
        """Start the Redis pub/sub listener. Call from app lifespan."""
        self._redis = redis
        self._subscriber_task = asyncio.create_task(self._subscribe_loop())

    async def stop(self) -> None:
        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

    async def _subscribe_loop(self) -> None:
        import redis.asyncio as aioredis
        from app.core.config import settings

        pubsub_client = aioredis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )
        async with pubsub_client.pubsub() as ps:
            await ps.psubscribe("siq:*")
            try:
                async for message in ps.listen():
                    if message["type"] not in ("pmessage", "message"):
                        continue
                    try:
                        channel: str = message.get("channel", "")
                        data = json.loads(message["data"])
                        await self._dispatch_redis_message(channel, data)
                    except Exception:
                        pass
            except asyncio.CancelledError:
                pass
        await pubsub_client.aclose()

    async def _dispatch_redis_message(self, channel: str, data: dict) -> None:
        # Skip messages we published ourselves (already delivered locally)
        if data.get("_src") == _INSTANCE_ID:
            return

        if channel.startswith(_CHAN_CONV):
            conv_id = channel[len(_CHAN_CONV):]
            exclude = data.pop("_exclude_user_id", None)
            data.pop("_src", None)
            await self._local_broadcast_conv(conv_id, data, exclude)
        elif channel.startswith(_CHAN_TENANT):
            data.pop("_src", None)
            tenant_id = channel[len(_CHAN_TENANT):]
            await self._local_broadcast_tenant(tenant_id, data)

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    async def connect(self, ws: WebSocket, user_id: str, tenant_id: str) -> None:
        self._user_sockets[user_id].append(ws)
        self._tenant_online[tenant_id].add(user_id)

    async def disconnect(self, ws: WebSocket, user_id: str, tenant_id: str) -> None:
        sockets = self._user_sockets.get(user_id, [])
        if ws in sockets:
            sockets.remove(ws)
        if not sockets:
            self._user_sockets.pop(user_id, None)
            self._tenant_online[tenant_id].discard(user_id)
            # Remove from all conversation rooms
            for members in self._conv_members.values():
                members.discard(user_id)

    # ------------------------------------------------------------------
    # Conversation room management
    # ------------------------------------------------------------------

    def join_conversation(self, user_id: str, conversation_id: str) -> None:
        self._conv_members[conversation_id].add(user_id)

    def leave_conversation(self, user_id: str, conversation_id: str) -> None:
        self._conv_members[conversation_id].discard(user_id)

    def get_conv_members(self, conversation_id: str) -> set[str]:
        return self._conv_members.get(conversation_id, set())

    # ------------------------------------------------------------------
    # Presence
    # ------------------------------------------------------------------

    def get_online_users(self, tenant_id: str) -> list[str]:
        return list(self._tenant_online.get(tenant_id, set()))

    def is_online(self, user_id: str) -> bool:
        return bool(self._user_sockets.get(user_id))

    # ------------------------------------------------------------------
    # Send helpers (local process only)
    # ------------------------------------------------------------------

    async def _send_to_user(self, user_id: str, data: dict) -> None:
        for ws in list(self._user_sockets.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    async def _local_broadcast_conv(
        self, conversation_id: str, data: dict, exclude_user_id: str | None = None
    ) -> None:
        for uid in list(self._conv_members.get(conversation_id, set())):
            if uid != exclude_user_id:
                await self._send_to_user(uid, data)

    async def _local_broadcast_tenant(self, tenant_id: str, data: dict) -> None:
        for uid in list(self._tenant_online.get(tenant_id, set())):
            await self._send_to_user(uid, data)

    # ------------------------------------------------------------------
    # Public broadcast API (publishes to Redis → other workers pick it up)
    # ------------------------------------------------------------------

    async def broadcast_to_conversation(
        self,
        conversation_id: str,
        data: dict,
        exclude_user_id: str | None = None,
    ) -> None:
        """Broadcast to all clients subscribed to a conversation room."""
        # Local delivery first
        await self._local_broadcast_conv(conversation_id, dict(data), exclude_user_id)

        # Cross-process via Redis — tag with our instance ID so we don't re-deliver
        if self._redis:
            payload = dict(data)
            payload["_src"] = _INSTANCE_ID
            if exclude_user_id:
                payload["_exclude_user_id"] = exclude_user_id
            try:
                await self._redis.publish(
                    f"{_CHAN_CONV}{conversation_id}", json.dumps(payload)
                )
            except Exception as exc:
                log.warning("redis.publish failed", error=str(exc))

    async def broadcast_to_tenant(self, tenant_id: str, data: dict) -> None:
        """Broadcast to all online clients in a tenant (presence, queue updates)."""
        await self._local_broadcast_tenant(tenant_id, data)
        if self._redis:
            payload = dict(data)
            payload["_src"] = _INSTANCE_ID
            try:
                await self._redis.publish(
                    f"{_CHAN_TENANT}{tenant_id}", json.dumps(payload)
                )
            except Exception as exc:
                log.warning("redis.publish failed", error=str(exc))

    async def send_to_user(self, user_id: str, data: dict) -> None:
        await self._send_to_user(user_id, data)


manager = ConnectionManager()
