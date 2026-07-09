"""Sentence-transformer embedding service with Redis caching."""
from __future__ import annotations

import hashlib
import json
import structlog
from typing import Optional

from app.ai.model_manager import model_manager

log = structlog.get_logger(__name__)

_CACHE_PREFIX = "siq:emb:"


def _cache_key(text: str) -> str:
    digest = hashlib.sha256(text.encode()).hexdigest()[:32]
    return f"{_CACHE_PREFIX}{digest}"


async def embed(text: str, redis=None) -> Optional[list[float]]:
    """Return a 384-dim embedding for *text*.

    Returns None when the embedding model failed to load, so callers can
    gracefully degrade.
    """
    if not text or not text.strip():
        return None

    text = text.strip()

    # Try Redis cache first
    if redis:
        try:
            from app.core.config import settings
            cached = await redis.get(_cache_key(text))
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    try:
        model = await model_manager.embedding_model()
        if model is None:
            return None

        def _encode(t: str) -> list[float]:
            return model.encode(t, convert_to_numpy=True).tolist()

        vector: list[float] = await model_manager.run_in_executor(_encode, text)

        if redis:
            try:
                from app.core.config import settings
                await redis.setex(_cache_key(text), settings.embedding_cache_ttl, json.dumps(vector))
            except Exception:
                pass

        return vector
    except Exception as exc:
        log.warning("embed failed", error=str(exc))
        return None


async def embed_batch(texts: list[str]) -> list[Optional[list[float]]]:
    """Embed multiple texts using a single model call (more efficient)."""
    if not texts:
        return []

    try:
        model = await model_manager.embedding_model()
        if model is None:
            return [None] * len(texts)

        def _encode_batch(ts: list[str]) -> list[list[float]]:
            return model.encode(ts, convert_to_numpy=True).tolist()

        return await model_manager.run_in_executor(_encode_batch, texts)
    except Exception as exc:
        log.warning("embed_batch failed", error=str(exc))
        return [None] * len(texts)
