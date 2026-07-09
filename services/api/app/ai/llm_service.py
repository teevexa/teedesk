"""LLM response generation via Ollama (local, free, no API key needed).

Uses httpx async client against the Ollama /api/generate endpoint.
Includes hallucination prevention via a strict system prompt,
output validation, and safety filtering.
"""
from __future__ import annotations

import structlog
import re
from typing import Optional

import httpx

from app.core.config import settings

log = structlog.get_logger(__name__)

_SYSTEM_PROMPT = """You are a helpful, professional customer support assistant.

Rules you MUST follow:
1. Answer ONLY using the provided knowledge base context when available.
2. If the context does not contain enough information to answer, say:
   "I don't have enough information to answer that. Let me connect you with a human agent."
3. NEVER invent facts, product details, pricing, or policies.
4. Keep replies concise — 2-4 sentences max unless a step-by-step list is needed.
5. Be empathetic and polite.
6. Do not repeat the user's message back to them.
7. Do not start your reply with "I" — vary your sentence openings.
"""

_SAFETY_PATTERNS = [
    re.compile(r"\b(password|passwd|secret|api[_\s]?key|credit[_\s]?card)\b", re.I),
]

_MAX_RESPONSE_CHARS = 1200
_FALLBACK = "Thank you for reaching out. A support agent will be with you shortly to assist."


def _build_prompt(user_message: str, kb_context: list[dict], history: list[dict]) -> str:
    parts: list[str] = []

    if kb_context:
        parts.append("=== Knowledge Base Context ===")
        for i, art in enumerate(kb_context, 1):
            parts.append(f"[{i}] {art['title']}\n{art['content']}")
        parts.append("=== End Context ===\n")

    if history:
        parts.append("Recent conversation:")
        for h in history[-6:]:  # last 3 pairs
            role = "Customer" if not h.get("is_bot") else "Assistant"
            parts.append(f"{role}: {h['content']}")
        parts.append("")

    parts.append(f"Customer: {user_message}")
    parts.append("Assistant:")

    return "\n".join(parts)


def _validate_response(text: str) -> str:
    """Truncate, strip unsafe content, and ensure minimum quality."""
    text = text.strip()

    # Hard limit
    if len(text) > _MAX_RESPONSE_CHARS:
        text = text[:_MAX_RESPONSE_CHARS].rsplit(" ", 1)[0] + "…"

    # Safety: refuse to echo potential sensitive patterns
    for pattern in _SAFETY_PATTERNS:
        if pattern.search(text):
            return _FALLBACK

    # Must be a non-trivial response
    if len(text) < 10:
        return _FALLBACK

    return text


async def generate(
    user_message: str,
    kb_context: Optional[list[dict]] = None,
    history: Optional[list[dict]] = None,
    conversation_id: Optional[str] = None,
) -> str:
    """Generate a response for *user_message* using Ollama.

    Returns a validated response string.  Falls back to _FALLBACK on any error.
    """
    prompt = _build_prompt(user_message, kb_context or [], history or [])

    payload = {
        "model": settings.ollama_model,
        "system": _SYSTEM_PROMPT,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,    # low temperature → more factual
            "top_p": 0.9,
            "num_predict": 256,    # cap output tokens
            "stop": ["Customer:", "Human:", "\n\n\n"],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            raw = data.get("response", "").strip()
            return _validate_response(raw)

    except httpx.TimeoutException:
        log.warning("ollama.generate timeout", conversation_id=conversation_id)
        return _FALLBACK
    except httpx.HTTPStatusError as exc:
        log.warning("ollama.generate http error", status=exc.response.status_code, conversation_id=conversation_id)
        return _FALLBACK
    except Exception as exc:
        log.warning("ollama.generate error", error=str(exc), conversation_id=conversation_id)
        return _FALLBACK


async def is_available() -> bool:
    """Return True if Ollama is reachable and the configured model is loaded."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            return any(settings.ollama_model in m for m in models)
    except Exception:
        return False
