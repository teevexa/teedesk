"""Named entity recognition via spaCy en_core_web_sm.

Returns a list of entity dicts:
    [{"text": "...", "label": "ORG", "start": 0, "end": 5}, ...]

Interesting labels for a support context: ORG, PRODUCT, PERSON, DATE,
MONEY, CARDINAL.  We filter to these to avoid noise from GPE (locations)
etc. unless the client needs them.
"""
from __future__ import annotations

import structlog

from app.ai.model_manager import model_manager

log = structlog.get_logger(__name__)

_KEEP_LABELS = {"ORG", "PRODUCT", "PERSON", "DATE", "MONEY", "CARDINAL", "GPE"}


async def extract(text: str) -> list[dict]:
    """Return extracted entities for *text*. Returns [] on failure."""
    if not text or not text.strip():
        return []

    try:
        nlp = await model_manager.spacy_model()
        if nlp is None:
            return []

        def _run(t: str) -> list[dict]:
            doc = nlp(t[:1000])  # limit to avoid OOM on very long messages
            return [
                {
                    "text": ent.text,
                    "label": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char,
                }
                for ent in doc.ents
                if ent.label_ in _KEEP_LABELS
            ]

        return await model_manager.run_in_executor(_run, text)
    except Exception as exc:
        log.warning("ner.extract failed", error=str(exc))
        return []
