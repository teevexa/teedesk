from __future__ import annotations
import logging
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_agent, verify_tenant_access
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.document_parser import extract_text
from app.core.exceptions import BadRequestException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.knowledge import KnowledgeArticle
from app.models.user import User
from app.schemas.knowledge import ArticleCreate, ArticleResponse, ArticleUpdate
from app.services.knowledge_service import KnowledgeService

log = logging.getLogger(__name__)


async def _embed_article(svc: KnowledgeService, article_id: uuid.UUID, title: str, content: str) -> None:
    """Compute and persist the embedding for a knowledge article (runs as background task)."""
    try:
        from app.ai import embedding_service
        text = f"{title}\n\n{content}"
        vector = await embedding_service.embed(text)
        if vector is None:
            return
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(KnowledgeArticle)
                .where(KnowledgeArticle.id == article_id)
                .values(embedding=vector)
            )
    except Exception as exc:
        log.warning("knowledge.embed failed", article_id=str(article_id), error=str(exc))

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


def _svc(db: AsyncSession = Depends(get_db)) -> KnowledgeService:
    return KnowledgeService(db)


Svc = Annotated[KnowledgeService, Depends(_svc)]
Pagination = Annotated[PaginationParams, Depends()]
AuthUser = Annotated[User, Depends(get_current_user)]
AgentUser = Annotated[User, Depends(require_agent())]


@router.get("/categories", response_model=list[str])
async def list_categories(svc: Svc, current_user: AuthUser) -> list[str]:
    return await svc.list_categories(current_user.tenant_id)


@router.get("", response_model=PaginatedResponse[ArticleResponse])
async def list_articles(
    svc: Svc,
    pagination: Pagination,
    current_user: AuthUser,
    category: str | None = Query(None),
    tag: str | None = Query(None),
    is_published: bool | None = Query(None),
    search: str | None = Query(None, max_length=200),
) -> PaginatedResponse[ArticleResponse]:
    items, total = await svc.list(
        tenant_id=current_user.tenant_id,
        category=category,
        tag=tag,
        is_published=is_published,
        search=search,
        page=pagination.page,
        size=pagination.size,
    )
    return PaginatedResponse(
        items=[ArticleResponse.model_validate(a) for a in items],
        total=total,
        page=pagination.page,
        size=pagination.size,
        pages=max(1, -(-total // pagination.size)),
        has_next=pagination.page < max(1, -(-total // pagination.size)),
        has_prev=pagination.page > 1,
    )


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    svc: Svc, body: ArticleCreate, current_user: AgentUser
) -> ArticleResponse:
    body.tenant_id = current_user.tenant_id
    article = await svc.create(body)
    # Embed in background — non-blocking
    import asyncio
    asyncio.create_task(_embed_article(svc, article.id, body.title, body.content))
    return ArticleResponse.model_validate(article)


@router.post("/upload", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def upload_article(
    svc: Svc,
    current_user: AgentUser,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    category: str | None = Form(None),
    tags: str | None = Form(None),  # comma-separated
) -> ArticleResponse:
    """Create a knowledge article from an uploaded PDF or DOCX file."""
    content = await file.read()
    if not content:
        raise BadRequestException("Uploaded file is empty")
    max_bytes = settings.max_kb_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise BadRequestException(
            f"File exceeds the {settings.max_kb_upload_size_mb}MB upload limit"
        )

    text = extract_text(content, file.content_type or "")
    article_title = title or (Path(file.filename).stem if file.filename else "Untitled")
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    body = ArticleCreate(
        tenant_id=current_user.tenant_id,
        author_id=current_user.id,
        title=article_title,
        content=text,
        category=category,
        tags=tag_list,
        is_published=True,
    )
    article = await svc.create(body)
    import asyncio
    asyncio.create_task(_embed_article(svc, article.id, body.title, body.content))
    return ArticleResponse.model_validate(article)


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    svc: Svc, article_id: uuid.UUID, current_user: AuthUser
) -> ArticleResponse:
    article = await svc.get(article_id)
    verify_tenant_access(article.tenant_id, current_user)
    return ArticleResponse.model_validate(article)


@router.patch("/{article_id}", response_model=ArticleResponse)
async def update_article(
    svc: Svc, article_id: uuid.UUID, body: ArticleUpdate, current_user: AgentUser
) -> ArticleResponse:
    article = await svc.get(article_id)
    verify_tenant_access(article.tenant_id, current_user)
    article = await svc.update(article_id, body)
    # Re-embed if text changed
    if body.title or body.content:
        import asyncio
        asyncio.create_task(_embed_article(svc, article.id, article.title, article.content))
    return ArticleResponse.model_validate(article)


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_article(
    svc: Svc, article_id: uuid.UUID, current_user: AgentUser
) -> Response:
    article = await svc.get(article_id)
    verify_tenant_access(article.tenant_id, current_user)
    await svc.soft_delete(article_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{article_id}/view", response_model=ArticleResponse)
async def record_view(
    svc: Svc, article_id: uuid.UUID, current_user: AuthUser
) -> ArticleResponse:
    article = await svc.get(article_id)
    verify_tenant_access(article.tenant_id, current_user)
    article = await svc.increment_views(article_id)
    return ArticleResponse.model_validate(article)


@router.post("/{article_id}/helpful", response_model=ArticleResponse)
async def mark_helpful(
    svc: Svc,
    article_id: uuid.UUID,
    current_user: AuthUser,
    helpful: bool = Query(..., description="true = helpful, false = not helpful"),
) -> ArticleResponse:
    article = await svc.get(article_id)
    verify_tenant_access(article.tenant_id, current_user)
    article = await svc.mark_helpful(article_id, helpful)
    return ArticleResponse.model_validate(article)
