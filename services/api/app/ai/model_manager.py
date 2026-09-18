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


_MAX_LOAD_RETRIES = 3
_RETRY_BACKOFF_SECONDS = 10


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

    def _clear_ready(self, event: asyncio.Event) -> None:
        """Thread-safe: clear an asyncio.Event from a worker thread, so
        awaiters block again until a retry succeeds instead of getting a
        permanent None handle back immediately."""
        if self._loop and not self._loop.is_closed():
            self._loop.call_soon_threadsafe(event.clear)

    def _load_with_retry(self, name: str, event: asyncio.Event, load_fn) -> None:
        import time

        for attempt in range(1, _MAX_LOAD_RETRIES + 1):
            try:
                log.info(f"loading {name} model", attempt=attempt)
                load_fn()
                log.info(f"{name} model ready")
                self._signal_ready(event)
                return
            except Exception as exc:
                log.error(f"{name} model load failed", attempt=attempt, error=str(exc))
                if attempt < _MAX_LOAD_RETRIES:
                    time.sleep(_RETRY_BACKOFF_SECONDS)

        # All retries exhausted — signal ready anyway so callers stop blocking
        # forever, but the handle stays None and pipeline code degrades to
        # its fallback path. health() below reports this as unhealthy.
        log.error(f"{name} model permanently unavailable after {_MAX_LOAD_RETRIES} attempts")
        self._signal_ready(event)

    def _load_embedding(self) -> None:
        def _do() -> None:
            from sentence_transformers import SentenceTransformer
            from app.core.config import settings
            self._embedding_model = SentenceTransformer(settings.embedding_model)

        self._load_with_retry("embedding", self._embedding_ready, _do)

    def _load_sentiment(self) -> None:
        def _do() -> None:
            from transformers import pipeline as hf_pipeline
            from app.core.config import settings
            self._sentiment_pipeline = hf_pipeline(
                "sentiment-analysis",
                model=settings.sentiment_model,
                device=-1,   # CPU
                top_k=None,  # return all labels + scores
            )

        self._load_with_retry("sentiment", self._sentiment_ready, _do)

    def _load_spacy(self) -> None:
        def _do() -> None:
            import spacy
            from app.core.config import settings
            self._spacy_model = spacy.load(settings.spacy_model)

        self._load_with_retry("spacy", self._spacy_ready, _do)

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
