"""SlowAPI rate limiter — shared limiter instance and limit dependency helpers."""
from __future__ import annotations

from slowapi import Limiter

from app.core.net import get_client_ip

limiter = Limiter(key_func=get_client_ip, default_limits=["200/minute"])

# Per-endpoint limit strings (used with @limiter.limit when annotations are compatible)
AUTH_LIMIT = "10/minute"
REGISTER_LIMIT = "5/minute"
RESET_LIMIT = "3/minute"
API_LIMIT = "120/minute"
STRICT_LIMIT = "5/minute"
