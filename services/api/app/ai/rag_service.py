"""Retrieval-Augmented Generation via pgvector cosine distance.

Queries the knowledge_articles table for the top-K most similar articles
to the user's message embedding.  Results are passed to the LLM as
context so it can ground its reply in real KB content.
"""
from __future__ import annotations

import structlog
from typing import Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

log = structlog.get_logger(__name__)


async def retrieve(
    query_embedding: list[float],
    db: AsyncSession,
    tenant_id: str,
    top_k: Optional[int] = None,
    min_similarity: Optional[float] = None,
) -> list[dict]:
    """Return up to *top_k* knowledge articles ordered by cosine similarity.

    Each result dict: {"id", "title", "content", "similarity"}.
    Returns [] if embedding unavailable or no articles found.
    """
    if not query_embedding:
        return []

    k = top_k or settings.rag_top_k
    threshold = min_similarity if min_similarity is not None else settings.rag_min_similarity

    try:
        from app.models.knowledge import KnowledgeArticle

        # pgvector cosine distance operator: <=>  (0 = identical, 2 = opposite)
        # similarity = 1 - cosine_distance
        vector_literal = f"[{','.join(str(v) for v in query_embedding)}]"

        stmt = text(
            """
            SELECT id, title, content,
                   1 - (embedding <=> :vec ::vector) AS similarity
            FROM knowledge_articles
            WHERE tenant_id = :tenant_id
              AND is_published = true
              AND deleted_at IS NULL
              AND embedding IS NOT NULL
              AND 1 - (embedding <=> :vec ::vector) >= :threshold
            ORDER BY embedding <=> :vec ::vector
            LIMIT :limit
            """
        )
        result = await db.execute(
            stmt,
            {"vec": vector_literal, "tenant_id": UUID(tenant_id), "threshold": threshold, "limit": k},
        )
        rows = result.fetchall()

        return [
            {
                "id": str(row.id),
                "title": row.title,
                "content": row.content[:2000],  # cap context size per article
                "similarity": round(row.similarity, 4),
            }
            for row in rows
        ]
    except Exception as exc:
        log.warning("rag.retrieve failed", error=str(exc))
        return []
