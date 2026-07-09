from __future__ import annotations
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_agent
from app.core.database import get_db
from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.services.feedback_service import FeedbackService

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/feedback", tags=["Feedback"])


def _svc(db: AsyncSession = Depends(get_db)) -> FeedbackService:
    return FeedbackService(db)


Svc = Annotated[FeedbackService, Depends(_svc)]
Pagination = Annotated[PaginationParams, Depends()]
AuthUser = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[FeedbackResponse])
async def list_feedback(
    svc: Svc,
    pagination: Pagination,
    current_user: Annotated[User, Depends(require_agent())],
    conversation_id: uuid.UUID | None = Query(None),
    message_id: uuid.UUID | None = Query(None),
    rating: str | None = Query(None, pattern="^(positive|negative)$"),
) -> PaginatedResponse[FeedbackResponse]:
    items, total = await svc.list(
        conversation_id=conversation_id,
        message_id=message_id,
        rating=rating,
        page=pagination.page,
        size=pagination.size,
    )
    return PaginatedResponse(
        items=[FeedbackResponse.model_validate(f) for f in items],
        total=total,
        page=pagination.page,
        size=pagination.size,
        pages=max(1, -(-total // pagination.size)),
        has_next=pagination.page < max(1, -(-total // pagination.size)),
        has_prev=pagination.page > 1,
    )


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    svc: Svc,
    body: FeedbackCreate,
    current_user: AuthUser,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    if not body.user_id:
        body.user_id = current_user.id
    fb = await svc.create(body)

    # On positive feedback, queue the message as candidate training data
    if fb.rating == "positive":
        background.add_task(
            _queue_training_data,
            message_id=fb.message_id,
            tenant_id=current_user.tenant_id,
            db=db,
        )

    return FeedbackResponse.model_validate(fb)


@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback(
    svc: Svc, feedback_id: uuid.UUID, current_user: AuthUser
) -> FeedbackResponse:
    fb = await svc.get(feedback_id)
    return FeedbackResponse.model_validate(fb)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _queue_training_data(
    message_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Create a TrainingData record from a positively-rated bot message.

    The record starts unverified — an admin reviews and marks it verified
    before the retrain task promotes it into the intent examples.
    """
    from sqlalchemy import select
    from app.models.message import Message
    from app.models.training_data import TrainingData

    try:
        # Fetch the bot message that was rated
        result = await db.execute(select(Message).where(Message.id == message_id))
        bot_msg = result.scalar_one_or_none()
        if bot_msg is None or not bot_msg.is_bot:
            return

        # Fetch the preceding user message in the same conversation
        user_msg_result = await db.execute(
            select(Message)
            .where(
                Message.conversation_id == bot_msg.conversation_id,
                Message.is_bot.is_(False),
                Message.created_at < bot_msg.created_at,
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        user_msg = user_msg_result.scalar_one_or_none()
        if user_msg is None:
            return

        # Avoid duplicate training records for the same message
        existing = await db.execute(
            select(TrainingData).where(TrainingData.message_id == user_msg.id)
        )
        if existing.scalar_one_or_none() is not None:
            return

        td = TrainingData(
            tenant_id=tenant_id,
            message_id=user_msg.id,
            input_text=user_msg.content,
            labeled_intent=bot_msg.intent,
            labeled_sentiment=bot_msg.sentiment,
            labeled_entities=bot_msg.entities or [],
            is_verified=False,
            source="feedback",
        )
        db.add(td)
        await db.commit()
        log.info("training_data.queued", message_id=str(user_msg.id), intent=bot_msg.intent)
    except Exception as exc:
        log.warning("training_data.queue_failed", error=str(exc))
        await db.rollback()
