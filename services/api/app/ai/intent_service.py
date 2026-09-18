"""Intent classification via cosine similarity.

Intent examples are stored in the `intents` table (app.models.intent).
Each intent row has a list of example strings; we embed those examples
once (cached) and compare against the incoming message embedding.

No retraining needed — add examples to the DB to teach the classifier
new intents at runtime.
"""
from __future__ import annotations

import structlog
from typing import Optional
from uuid import UUID

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import embedding_service
from app.core.config import settings

log = structlog.get_logger(__name__)

# In-process cache: tenant_id → list[(intent_name, confidence_threshold, embeddings)]
_intent_cache: dict[str, list[tuple[str, float, list[list[float]]]]] = {}


async def _load_intents(db: AsyncSession, tenant_id: str) -> list[tuple[str, float, list[list[float]]]]:
    """Load and embed intent examples for a tenant. Results are cached in-process."""
    if tenant_id in _intent_cache:
        return _intent_cache[tenant_id]

    from app.models.intent import Intent  # avoid circular at module load time
    result = await db.execute(
        select(Intent).where(Intent.tenant_id == UUID(tenant_id), Intent.is_active == True)  # noqa: E712
    )
    intents = result.scalars().all()

    loaded: list[tuple[str, float, list[list[float]]]] = []
    for intent in intents:
        examples: list[str] = intent.examples or []
        if not examples:
            continue
        vecs = await embedding_service.embed_batch(examples)
        valid = [v for v in vecs if v is not None]
        if valid:
            threshold = float(intent.confidence_threshold) if intent.confidence_threshold else settings.intent_min_confidence
            loaded.append((intent.name, threshold, valid))

    _intent_cache[tenant_id] = loaded
    return loaded


def _cosine(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def invalidate_cache(tenant_id: str) -> None:
    """Call when intent examples are added or modified."""
    _intent_cache.pop(tenant_id, None)


async def classify(
    text: str,
    db: AsyncSession,
    tenant_id: str,
    query_embedding: Optional[list[float]] = None,
    min_confidence: Optional[float] = None,
) -> tuple[Optional[str], float]:
    """Return (intent_name, confidence). intent_name is None when below threshold.

    `min_confidence`, when given (the tenant's TenantSettings.confidence_threshold),
    overrides the global `settings.intent_min_confidence` as the gate used for
    messages that don't match any per-intent-configured threshold below.
    """
    if not text.strip():
        return None, 0.0

    vec = query_embedding or await embedding_service.embed(text)
    if vec is None:
        return None, 0.0

    try:
        intent_defs = await _load_intents(db, tenant_id)
    except Exception as exc:
        log.warning("intent.load failed", error=str(exc))
        return None, 0.0

    best_intent: Optional[str] = None
    best_score: float = 0.0
    best_threshold: float = min_confidence if min_confidence is not None else settings.intent_min_confidence

    for name, threshold, example_vecs in intent_defs:
        scores = [_cosine(vec, ev) for ev in example_vecs]
        score = max(scores) if scores else 0.0
        if score > best_score:
            best_score = score
            best_intent = name
            best_threshold = threshold

    if best_score >= best_threshold:
        return best_intent, round(best_score, 4)
    return None, round(best_score, 4)
