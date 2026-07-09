"""Fine-tuning pipeline — promote feedback into intent examples.

How it works:
  1. After positive feedback, a TrainingData row is created with the user
     message and the bot's predicted intent (source="feedback").
  2. An admin verifies promising examples via the admin API (is_verified=True).
  3. This Celery task runs nightly (or on-demand via POST /api/v1/admin/retrain)
     and adds verified examples to the matching Intent.examples column.
  4. The in-process intent cache is invalidated so the new examples take effect
     on the next request — no model download or GPU required.

This is incremental learning via similarity search, not gradient descent.
It's fast, deterministic, and works at any scale without a training server.
"""
from __future__ import annotations

import asyncio
import logging

import structlog
from sqlalchemy import select, update

from app.tasks.celery_app import celery_app

log = structlog.get_logger(__name__)


@celery_app.task(name="app.tasks.retrain.retrain_tenant", bind=True, max_retries=3)
def retrain_tenant(self, tenant_id: str) -> dict:  # type: ignore[override]
    """Promote verified TrainingData rows into Intent examples for one tenant."""
    return asyncio.get_event_loop().run_until_complete(_retrain_tenant_async(tenant_id))


@celery_app.task(name="app.tasks.retrain.retrain_all_tenants", bind=True)
def retrain_all_tenants(self) -> dict:  # type: ignore[override]
    """Nightly task — retrain all active tenants."""
    return asyncio.get_event_loop().run_until_complete(_retrain_all_async())


async def _retrain_all_async() -> dict:
    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Tenant.id).where(Tenant.is_active.is_(True)))
        tenant_ids = [str(row.id) for row in result.all()]

    results = {}
    for tid in tenant_ids:
        results[tid] = await _retrain_tenant_async(tid)
    return results


async def _retrain_tenant_async(tenant_id: str) -> dict:
    from uuid import UUID
    from app.core.database import AsyncSessionLocal
    from app.models.intent import Intent
    from app.models.training_data import TrainingData
    from app.ai.intent_service import invalidate_cache

    added = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        # Fetch all verified, unprocessed training data that has a labeled intent
        td_result = await db.execute(
            select(TrainingData).where(
                TrainingData.tenant_id == UUID(tenant_id),
                TrainingData.is_verified.is_(True),
                TrainingData.labeled_intent.is_not(None),
                TrainingData.source.in_(["feedback", "manual"]),
            )
        )
        rows = td_result.scalars().all()

        if not rows:
            log.info("retrain.no_data", tenant_id=tenant_id)
            return {"tenant_id": tenant_id, "added": 0, "skipped": 0}

        # Group by intent name
        by_intent: dict[str, list[str]] = {}
        for row in rows:
            intent_name = row.labeled_intent
            if intent_name:
                by_intent.setdefault(intent_name, []).append(row.input_text)

        for intent_name, new_examples in by_intent.items():
            # Find the matching Intent row for this tenant
            intent_result = await db.execute(
                select(Intent).where(
                    Intent.tenant_id == UUID(tenant_id),
                    Intent.name == intent_name,
                    Intent.is_active.is_(True),
                )
            )
            intent = intent_result.scalar_one_or_none()

            if intent is None:
                # Auto-create the intent if it doesn't exist yet
                intent = Intent(
                    tenant_id=UUID(tenant_id),
                    name=intent_name,
                    examples=new_examples,
                )
                db.add(intent)
                added += len(new_examples)
            else:
                # Merge: add only examples that aren't already present (dedup)
                existing = set(intent.examples or [])
                to_add = [e for e in new_examples if e not in existing]
                if to_add:
                    await db.execute(
                        update(Intent)
                        .where(Intent.id == intent.id)
                        .values(examples=list(existing) + to_add)
                    )
                    added += len(to_add)
                else:
                    skipped += len(new_examples)

        await db.commit()

    # Bust the in-process cache so new examples are picked up immediately
    invalidate_cache(tenant_id)

    log.info("retrain.done", tenant_id=tenant_id, added=added, skipped=skipped)
    return {"tenant_id": tenant_id, "added": added, "skipped": skipped}
