"""Client IP extraction — trusted-proxy-aware.

`X-Forwarded-For` is attacker-controlled unless the request actually passed
through a proxy we trust to have appended (not replaced) it. We only trust
the last `settings.trusted_proxy_count` entries — the ones our own reverse
proxy chain appended — and fall back to the raw socket address otherwise.
Defaulting `trusted_proxy_count` to 0 means XFF is ignored entirely unless
a deployment explicitly declares how many trusted hops sit in front of it.
"""
from __future__ import annotations

from fastapi import Request

from app.core.config import settings


def get_client_ip(request: Request) -> str:
    trusted = settings.trusted_proxy_count
    if trusted > 0:
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            parts = [p.strip() for p in xff.split(",") if p.strip()]
            if len(parts) >= trusted:
                return parts[-trusted]
    return request.client.host if request.client else "unknown"
