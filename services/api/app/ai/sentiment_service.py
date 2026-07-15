"""Sentiment analysis via cardiffnlp/twitter-roberta-base-sentiment-latest.

Returns label ("positive"|"negative"|"neutral") and a score in [-1, 1]
where -1 is maximally negative and +1 is maximally positive.
"""
from __future__ import annotations

import hashlib
import json
import structlog
from typing import Optional

from app.ai.model_manager import model_manager

log = structlog.get_logger(__name__)

_CACHE_PREFIX = "td:sent:"

# Label mapping from the cardiffnlp model's output labels to our enum
_LABEL_MAP = {
    "LABEL_0": "negative",
    "LABEL_1": "neutral",
    "LABEL_2": "positive",
    # Some versions of the model use explicit strings
    "negative": "negative",
    "neutral": "neutral",
    "positive": "positive",
}


def _cache_key(text: str) -> str:
    digest = hashlib.sha256(text.encode()).hexdigest()[:32]
    return f"{_CACHE_PREFIX}{digest}"


def _scores_to_result(scores: list[dict]) -> tuple[str, float]:
    """Convert list[{label, score}] → (label, scalar_score in [-1,1])."""
    by_label: dict[str, float] = {}
    for item in scores:
        mapped = _LABEL_MAP.get(item["label"], "neutral")
        by_label[mapped] = item["score"]

    neg = by_label.get("negative", 0.0)
    neu = by_label.get("neutral", 0.0)
    pos = by_label.get("positive", 0.0)

    # Scalar: positive scores → +, negative → -
    scalar = pos - neg

    # Dominant label
    if pos >= neg and pos >= neu:
        label = "positive"
    elif neg > pos and neg >= neu:
        label = "negative"
    else:
        label = "neutral"

    return label, round(scalar, 4)


async def analyze(text: str, redis=None) -> tuple[Optional[str], Optional[float]]:
    """Return (label, score) for *text*; both None on failure."""
    if not text or not text.strip():
        return None, None

    # Truncate to 512 chars — the model was trained on tweets; long text degrades quality
    text = text.strip()[:512]

    if redis:
        try:
            cached = await redis.get(_cache_key(text))
            if cached:
                data = json.loads(cached)
                return data["label"], data["score"]
        except Exception:
            pass

    try:
        pipe = await model_manager.sentiment_pipeline()
        if pipe is None:
            return None, None

        def _run(t: str):
            return pipe(t, truncation=True, max_length=128)

        result = await model_manager.run_in_executor(_run, text)
        # result is list[list[dict]] when top_k=None
        scores = result[0] if isinstance(result[0], list) else result
        label, score = _scores_to_result(scores)

        if redis:
            try:
                from app.core.config import settings
                await redis.setex(
                    _cache_key(text),
                    settings.sentiment_cache_ttl,
                    json.dumps({"label": label, "score": score}),
                )
            except Exception:
                pass

        return label, score
    except Exception as exc:
        log.warning("sentiment.analyze failed", error=str(exc))
        return None, None
