"""AI inference pipeline orchestrator.

Runs embedding, sentiment, NER, intent, RAG, and LLM in an optimal order:
  Phase 1 (parallel): embed + sentiment + NER
  Phase 2 (depends on embed): intent classification + RAG retrieval
  Phase 3 (depends on RAG): LLM generation

Every step degrades gracefully — a failure returns None/[] rather than
raising, so the chat system always responds even when AI is unavailable.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import embedding_service, ner_service, sentiment_service
from app.ai import intent_service, rag_service, llm_service
from app.core.config import settings
from app.services.tenant_settings_service import TenantSettingsService

log = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    # Embedding (not exposed to frontend, used internally)
    embedding: Optional[list[float]] = None

    # Sentiment
    sentiment: Optional[str] = None          # "positive" | "negative" | "neutral"
    sentiment_score: Optional[float] = None  # [-1, 1]

    # NER
    entities: list[dict] = field(default_factory=list)

    # Intent
    intent: Optional[str] = None
    intent_confidence: float = 0.0

    # RAG
    knowledge_articles: list[dict] = field(default_factory=list)

    # Generated reply
    response: str = ""

    # Pipeline meta
    escalation_recommended: bool = False
    fallback_used: bool = False

    def to_frontend_dict(self) -> dict:
        """Subset safe to send over WebSocket to the client."""
        return {
            "sentiment": self.sentiment,
            "sentiment_score": self.sentiment_score,
            "entities": self.entities,
            "intent": self.intent,
            "intent_confidence": self.intent_confidence,
            "knowledge_article_ids": [a["id"] for a in self.knowledge_articles],
            "escalation_recommended": self.escalation_recommended,
        }


async def _disabled() -> tuple[None, None]:
    """Stand-in for a pipeline stage the tenant has turned off.

    Mirrors the (label, score) shape sentiment_service.analyze() returns on
    failure, so a disabled stage looks identical to a failed one downstream —
    no new state to invent.
    """
    return None, None


async def run(
    user_message: str,
    db: AsyncSession,
    tenant_id: str,
    conversation_id: str,
    redis=None,
    history: Optional[list[dict]] = None,
) -> AnalysisResult:
    """Full pipeline for a single incoming customer message.

    Returns an AnalysisResult.  Never raises.
    """
    result = AnalysisResult()

    if not settings.ai_pipeline_enabled:
        result.response = llm_service._FALLBACK
        result.fallback_used = True
        return result

    # Fetch the tenant's settings once per run — governs which stages run
    # below. get_or_create means every tenant implicitly has a row, so this
    # never raises NotFound; on any other failure we degrade to the global
    # defaults (all stages enabled) rather than fail the whole pipeline.
    tenant_settings = None
    try:
        tenant_settings = await TenantSettingsService(db).get_or_create(uuid.UUID(tenant_id))
    except Exception as exc:
        log.warning("pipeline.tenant_settings.load_failed", error=str(exc))
        # A failed flush (e.g. FK violation for an unknown tenant_id, as the
        # legacy generate_response() shim can pass) leaves the session's
        # transaction unusable until rolled back — reset it so later stages
        # sharing this same `db` can still run.
        await db.rollback()

    sentiment_enabled = tenant_settings is None or tenant_settings.enable_sentiment_analysis
    intent_enabled = tenant_settings is None or tenant_settings.enable_intent_detection

    # ---------------------------------------------------------------
    # Phase 1: parallel — embed, sentiment, NER
    # ---------------------------------------------------------------
    embed_task = embedding_service.embed(user_message, redis=redis)
    sentiment_task = (
        sentiment_service.analyze(user_message, redis=redis)
        if sentiment_enabled
        else _disabled()
    )
    ner_task = ner_service.extract(user_message)

    _p1 = await asyncio.gather(embed_task, sentiment_task, ner_task, return_exceptions=True)

    embedding = _p1[0] if not isinstance(_p1[0], Exception) else None
    _sent = _p1[1]
    sentiment_label, sentiment_score = _sent if isinstance(_sent, tuple) else (None, None)
    entities = _p1[2] if isinstance(_p1[2], list) else []

    result.embedding = embedding
    result.sentiment = sentiment_label
    result.sentiment_score = sentiment_score
    result.entities = entities

    # ---------------------------------------------------------------
    # Phase 2: intent + RAG (both need embedding)
    # ---------------------------------------------------------------
    intent_name: Optional[str] = None
    intent_confidence: float = 0.0
    kb_articles: list[dict] = []

    if embedding:
        # Intent and RAG both use the same db session — run sequentially to
        # avoid SQLAlchemy's "concurrent operations not permitted" error.
        if intent_enabled:
            try:
                _intent = await intent_service.classify(
                    user_message,
                    db=db,
                    tenant_id=tenant_id,
                    query_embedding=embedding,
                    min_confidence=(
                        tenant_settings.confidence_threshold if tenant_settings else None
                    ),
                )
                intent_name, intent_confidence = _intent if isinstance(_intent, tuple) else (None, 0.0)
            except Exception:
                intent_name, intent_confidence = None, 0.0

        try:
            kb_articles = await rag_service.retrieve(embedding, db=db, tenant_id=tenant_id)
        except Exception:
            kb_articles = []

    result.intent = intent_name
    result.intent_confidence = float(intent_confidence) if isinstance(intent_confidence, (int, float)) else 0.0
    result.knowledge_articles = kb_articles

    # ---------------------------------------------------------------
    # Phase 3: LLM generation
    # ---------------------------------------------------------------
    response = await llm_service.generate(
        user_message,
        kb_context=result.knowledge_articles,
        history=history,
        conversation_id=conversation_id,
    )

    if response == llm_service._FALLBACK:
        result.fallback_used = True
    result.response = response

    # ---------------------------------------------------------------
    # Auto-escalation signal
    # ---------------------------------------------------------------
    # Per-tenant enable_auto_escalation gates this entirely; when it's on we
    # still use the existing global escalation_sentiment_threshold — the
    # tenant's confidence_threshold is a different concept (intent
    # confidence, wired into intent_service.classify above), not escalation.
    auto_escalation_enabled = (
        tenant_settings.enable_auto_escalation if tenant_settings else settings.enable_auto_escalation
    )
    if (
        auto_escalation_enabled
        and result.sentiment_score is not None
        and result.sentiment_score < settings.escalation_sentiment_threshold
    ):
        result.escalation_recommended = True

    return result
