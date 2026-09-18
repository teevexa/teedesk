"""Text extraction for knowledge-base document ingestion (PDF/DOCX)."""
from __future__ import annotations

import io

from app.core.exceptions import BadRequestException

_SUPPORTED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


def extract_text(content: bytes, content_type: str) -> str:
    kind = _SUPPORTED_CONTENT_TYPES.get(content_type)
    if kind is None:
        raise BadRequestException(
            "Unsupported file type — only PDF and DOCX are supported for "
            "knowledge base document ingestion"
        )
    text = _extract_pdf(content) if kind == "pdf" else _extract_docx(content)
    if not text.strip():
        raise BadRequestException(
            "Could not extract any text from this file (it may be scanned/image-only)"
        )
    return text


def _extract_pdf(content: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content))
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(p for p in pages if p)


def _extract_docx(content: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)
