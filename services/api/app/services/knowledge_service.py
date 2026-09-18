from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.knowledge import KnowledgeArticle
from app.schemas.knowledge import ArticleCreate, ArticleUpdate


class KnowledgeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, article_id: uuid.UUID, include_deleted: bool = False) -> KnowledgeArticle:
        article = await self.db.get(KnowledgeArticle, article_id)
        if article is None or (not include_deleted and article.is_deleted):
            raise NotFoundException("KnowledgeArticle", article_id)
        return article

    async def list(
        self,
        tenant_id: uuid.UUID,
        category: str | None = None,
        tag: str | None = None,
        is_published: bool | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[Sequence[KnowledgeArticle], int]:
        stmt = select(KnowledgeArticle).where(
            KnowledgeArticle.tenant_id == tenant_id,
            KnowledgeArticle.deleted_at.is_(None),
        )
        if category:
            stmt = stmt.where(KnowledgeArticle.category == category)
        if tag:
            stmt = stmt.where(KnowledgeArticle.tags.contains([tag]))
        if is_published is not None:
            stmt = stmt.where(KnowledgeArticle.is_published == is_published)
        if search:
            like = f"%{search}%"
            stmt = stmt.where(
                or_(
                    KnowledgeArticle.title.ilike(like),
                    KnowledgeArticle.content.ilike(like),
                )
            )

        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()

        stmt = stmt.order_by(KnowledgeArticle.created_at.desc()).offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def list_categories(self, tenant_id: uuid.UUID) -> list[str]:
        stmt = (
            select(KnowledgeArticle.category)
            .where(
                KnowledgeArticle.tenant_id == tenant_id,
                KnowledgeArticle.deleted_at.is_(None),
                KnowledgeArticle.category.is_not(None),
            )
            .distinct()
            .order_by(KnowledgeArticle.category.asc())
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows)

    async def create(self, data: ArticleCreate) -> KnowledgeArticle:
        article = KnowledgeArticle(
            tenant_id=data.tenant_id,
            author_id=data.author_id,
            title=data.title,
            content=data.content,
            category=data.category,
            tags=data.tags,
            is_published=data.is_published,
            source_url=data.source_url,
        )
        self.db.add(article)
        await self.db.flush()
        await self.db.refresh(article)
        return article

    async def update(self, article_id: uuid.UUID, data: ArticleUpdate) -> KnowledgeArticle:
        article = await self.get(article_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(article, field, value)
        await self.db.flush()
        await self.db.refresh(article)
        return article

    async def soft_delete(self, article_id: uuid.UUID) -> None:
        article = await self.get(article_id)
        article.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def increment_views(self, article_id: uuid.UUID) -> KnowledgeArticle:
        article = await self.get(article_id)
        article.views += 1
        await self.db.flush()
        await self.db.refresh(article)
        return article

    async def mark_helpful(self, article_id: uuid.UUID, helpful: bool) -> KnowledgeArticle:
        article = await self.get(article_id)
        if helpful:
            article.helpful_count += 1
        else:
            article.not_helpful_count += 1
        await self.db.flush()
        await self.db.refresh(article)
        return article
