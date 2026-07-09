"""Lazy model loader.

Models are loaded once in background threads on first use so startup
remains fast.  Each model gate is an asyncio.Event; callers await the
event before using the model handle.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import structlog

log = structlog.get_logger(__name__)

# Thread pool dedicated to CPU-bound model inference
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ai_worker")


class ModelManager:
    def __init__(self) -> None:
        self._embedding_model: Any = None
        self._sentiment_pipeline: Any = None
        self._spacy_model: Any = None

        self._embedding_ready = asyncio.Event()
        self._sentiment_ready = asyncio.Event()
        self._spacy_ready = asyncio.Event()

        # Captured on the main async thread so worker threads can schedule callbacks
        self._loop: asyncio.AbstractEventLoop | None = None

    # ------------------------------------------------------------------
    # Startup
    # ------------------------------------------------------------------

    async def load_all(self) -> None:
        """Schedule all model loads concurrently. Call from app lifespan."""
        self._loop = asyncio.get_running_loop()
        await asyncio.gather(
            self._loop.run_in_executor(_executor, self._load_embedding),
            self._loop.run_in_executor(_executor, self._load_sentiment),
            self._loop.run_in_executor(_executor, self._load_spacy),
            return_exceptions=True,
        )

    def _signal_ready(self, event: asyncio.Event) -> None:
        """Thread-safe: set an asyncio.Event from a worker thread."""
        if self._loop and not self._loop.is_closed():
            self._loop.call_soon_threadsafe(event.set)

    def _load_embedding(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
            from app.core.config import settings
            log.info("loading embedding model", model=settings.embedding_model)
            self._embedding_model = SentenceTransformer(settings.embedding_model)
            log.info("embedding model ready")
        except Exception as exc:
            log.error("embedding model load failed", error=str(exc))
        finally:
            self._signal_ready(self._embedding_ready)

    def _load_sentiment(self) -> None:
        try:
            from transformers import pipeline as hf_pipeline
            from app.core.config import settings
            log.info("loading sentiment model", model=settings.sentiment_model)
            self._sentiment_pipeline = hf_pipeline(
                "sentiment-analysis",
                model=settings.sentiment_model,
                device=-1,   # CPU
                top_k=None,  # return all labels + scores
            )
            log.info("sentiment model ready")
        except Exception as exc:
            log.error("sentiment model load failed", error=str(exc))
        finally:
            self._signal_ready(self._sentiment_ready)

    def _load_spacy(self) -> None:
        try:
            import spacy
            from app.core.config import settings
            log.info("loading spacy model", model=settings.spacy_model)
            self._spacy_model = spacy.load(settings.spacy_model)
            log.info("spacy model ready")
        except Exception as exc:
            log.error("spacy model load failed", error=str(exc))
        finally:
            self._signal_ready(self._spacy_ready)

    # ------------------------------------------------------------------
    # Accessors (await the gate then call in executor)
    # ------------------------------------------------------------------

    async def embedding_model(self):
        await self._embedding_ready.wait()
        return self._embedding_model

    async def sentiment_pipeline(self):
        await self._sentiment_ready.wait()
        return self._sentiment_pipeline

    async def spacy_model(self):
        await self._spacy_ready.wait()
        return self._spacy_model

    # ------------------------------------------------------------------
    # Run CPU work on the shared executor
    # ------------------------------------------------------------------

    async def run_in_executor(self, fn, *args):
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(_executor, fn, *args)

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    def health(self) -> dict:
        return {
            "embedding": self._embedding_model is not None,
            "sentiment": self._sentiment_pipeline is not None,
            "spacy": self._spacy_model is not None,
        }


model_manager = ModelManager()
