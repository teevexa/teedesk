"""Bot service — delegates to the AI pipeline.

Falls back to a canned reply if the pipeline is disabled or unavailable.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pipeline import AnalysisResult, run as run_pipeline
from app.core.config import settings


async def process_message(
    content: str,
    conversation_id: str,
    db: AsyncSession,
    tenant_id: str,
    redis=None,
    history: list[dict] | None = None,
) -> AnalysisResult:
    """Run the full AI pipeline and return an AnalysisResult."""
    return await run_pipeline(
        user_message=content,
        db=db,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        redis=redis,
        history=history,
    )


async def generate_response(content: str, conversation_id: str) -> str:
    """Legacy shim — used by older call sites that only need the text reply."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await run_pipeline(
            user_message=content,
            db=db,
            tenant_id="00000000-0000-0000-0000-000000000000",
            conversation_id=conversation_id,
        )
    return result.response
