"""SlowAPI rate limiter — shared limiter instance and limit dependency helpers."""
from __future__ import annotations

from fastapi import Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _get_forwarded_ip(request: Request) -> str:
    """Prefer X-Forwarded-For (set by a trusted proxy) over remote addr."""
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_get_forwarded_ip, default_limits=["200/minute"])

# Per-endpoint limit strings (used with @limiter.limit when annotations are compatible)
AUTH_LIMIT = "10/minute"
REGISTER_LIMIT = "5/minute"
RESET_LIMIT = "3/minute"
API_LIMIT = "120/minute"
STRICT_LIMIT = "5/minute"
