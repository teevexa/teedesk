from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

router = APIRouter(tags=["System"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)) -> dict:
    db_ok = False
    redis_ok = False
    llm_ok = False

    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    try:
        from app.core.redis_client import get_redis
        await get_redis().ping()
        redis_ok = True
    except Exception:
        pass

    try:
        from app.ai import llm_service
        from app.ai.model_manager import model_manager
        llm_ok = await llm_service.is_available()
    except Exception:
        pass

    try:
        from app.ai.model_manager import model_manager
        model_health = model_manager.health()
    except Exception:
        model_health = {"embedding": False, "sentiment": False, "spacy": False}

    status_str = "ok" if db_ok else "degraded"
    return {
        "status": status_str,
        "version": "0.3.0",
        "environment": settings.environment,
        "services": {
            "database": db_ok,
            "redis": redis_ok,
            "llm": llm_ok,
        },
        "models": model_health,
    }


@router.get("/")
async def root() -> dict:
    return {
        "service": "SupportIQ API",
        "version": "0.2.0",
        "docs": "/docs",
        "health": "/health",
    }
