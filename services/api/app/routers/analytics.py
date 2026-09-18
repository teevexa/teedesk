"""Analytics endpoints — conversation stats, trends, and intent distribution."""
import structlog
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_agent
from app.core.database import get_db
from app.models.conversation import Conversation
from app.models.escalation import Escalation
from app.models.feedback import Feedback
from app.models.message import Message
from app.models.user import User

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

AuthAgent = Annotated[User, Depends(require_agent())]


def _since(period: str) -> datetime:
    days = {"day": 1, "7d": 7, "30d": 30, "90d": 90}
    return datetime.now(timezone.utc) - timedelta(days=days.get(period, 7))


def _empty_overview(period: str) -> dict:
    return {
        "totalConversations": 0, "openConversations": 0, "escalatedConversations": 0,
        "totalMessages": 0, "satisfactionRate": 0.0, "urgentIssues": 0,
        "sentimentDistribution": {"positive": 0, "negative": 0, "neutral": 0},
        "intentDistribution": {}, "period": period,
    }


@router.get("/overview")
async def get_overview(
    current_user: AuthAgent,
    db: AsyncSession = Depends(get_db),
    period: str = Query("7d", pattern="^(day|7d|30d|90d)$"),
) -> dict:
    try:
        return await _compute_overview(current_user, db, period)
    except Exception as exc:
        log.warning("analytics.overview.error", error=str(exc))
        return _empty_overview(period)


async def _compute_overview(current_user: User, db: AsyncSession, period: str) -> dict:
    since = _since(period)
    tid = current_user.tenant_id

    # Conversation counts by status
    conv_stmt = (
        select(
            func.count().label("total"),
            func.sum(case((Conversation.status == "open", 1), else_=0)).label("open"),
            func.sum(case((Conversation.status == "escalated", 1), else_=0)).label("escalated"),
        )
        .where(
            Conversation.tenant_id == tid,
            Conversation.created_at >= since,
            Conversation.deleted_at.is_(None),
        )
    )
    conv = (await db.execute(conv_stmt)).one()

    # Total messages in tenant conversations during period
    msg_count_stmt = (
        select(func.count())
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tid,
            Conversation.deleted_at.is_(None),
            Message.created_at >= since,
        )
    )
    total_messages = (await db.execute(msg_count_stmt)).scalar_one() or 0

    # Satisfaction rate — positive feedback / total feedback
    fb_stmt = (
        select(
            func.count().label("total"),
            func.sum(case((Feedback.rating == "positive", 1), else_=0)).label("positive"),
        )
        .select_from(Feedback)
        .join(Conversation, Feedback.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tid,
            Feedback.created_at >= since,
        )
    )
    fb = (await db.execute(fb_stmt)).one()
    satisfaction_rate = round((fb.positive / fb.total * 100) if fb.total else 0, 1)

    # Sentiment distribution (customer messages only)
    sent_stmt = (
        select(Message.sentiment, func.count().label("count"))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tid,
            Conversation.deleted_at.is_(None),
            Message.created_at >= since,
            Message.is_bot.is_(False),
            Message.sentiment.is_not(None),
        )
        .group_by(Message.sentiment)
    )
    sentiments = (await db.execute(sent_stmt)).all()
    sentiment_dist = {"positive": 0, "negative": 0, "neutral": 0}
    for row in sentiments:
        if row.sentiment in sentiment_dist:
            sentiment_dist[row.sentiment] = row.count

    # Intent distribution (top 10)
    intent_stmt = (
        select(Message.intent, func.count().label("count"))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tid,
            Conversation.deleted_at.is_(None),
            Message.created_at >= since,
            Message.intent.is_not(None),
        )
        .group_by(Message.intent)
        .order_by(func.count().desc())
        .limit(10)
    )
    intents = (await db.execute(intent_stmt)).all()
    intent_dist = {row.intent: row.count for row in intents if row.intent}

    # Urgent issues — unresolved escalations for this tenant
    esc_stmt = (
        select(func.count())
        .select_from(Escalation)
        .join(Conversation, Escalation.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tid,
            Escalation.resolved_at.is_(None),
        )
    )
    urgent = (await db.execute(esc_stmt)).scalar_one() or 0

    return {
        "totalConversations": conv.total or 0,
        "openConversations": conv.open or 0,
        "escalatedConversations": conv.escalated or 0,
        "totalMessages": total_messages,
        "satisfactionRate": satisfaction_rate,
        "urgentIssues": urgent,
        "sentimentDistribution": sentiment_dist,
        "intentDistribution": intent_dist,
        "period": period,
    }


@router.get("/trends")
async def get_trends(
    current_user: AuthAgent,
    db: AsyncSession = Depends(get_db),
    period: str = Query("7d", pattern="^(day|7d|30d|90d)$"),
) -> dict:
    since = _since(period)
    tid = current_user.tenant_id

    # Daily conversation counts
    conv_stmt = (
        select(
            func.date_trunc("day", Conversation.created_at).label("day"),
            func.count().label("count"),
        )
        .where(
            Conversation.tenant_id == tid,
            Conversation.created_at >= since,
            Conversation.deleted_at.is_(None),
        )
        .group_by("day")
        .order_by("day")
    )
    conv_rows = (await db.execute(conv_stmt)).all()

    # Daily message counts
    msg_stmt = (
        select(
            func.date_trunc("day", Message.created_at).label("day"),
            func.count().label("count"),
        )
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tid,
            Conversation.deleted_at.is_(None),
            Message.created_at >= since,
        )
        .group_by("day")
        .order_by("day")
    )
    msg_rows = (await db.execute(msg_stmt)).all()

    return {
        "conversations": [
            {"date": str(r.day.date()), "count": r.count} for r in conv_rows
        ],
        "messages": [
            {"date": str(r.day.date()), "count": r.count} for r in msg_rows
        ],
    }


@router.get("/intents")
async def get_top_intents(
    current_user: AuthAgent,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
) -> list[dict]:
    tid = current_user.tenant_id

    stmt = (
        select(Message.intent, func.count().label("count"))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tid,
            Conversation.deleted_at.is_(None),
            Message.intent.is_not(None),
        )
        .group_by(Message.intent)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [{"intent": r.intent, "count": r.count} for r in rows if r.intent]
