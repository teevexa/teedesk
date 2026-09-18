"""Local-disk storage helper for message attachments.

Files are written to `settings.attachment_storage_dir` under a generated
UUID-based name — the client-supplied filename is never used as the on-disk
name (avoids path traversal / collisions). The original filename is kept only
in the DB `filename` column for display and `Content-Disposition` purposes.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import status

from app.core.config import settings
from app.core.exceptions import BadRequestException, TeeDeskError


class FileTooLargeError(TeeDeskError):
    def __init__(self, max_mb: int) -> None:
        super().__init__(
            f"File exceeds maximum allowed size of {max_mb}MB",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            code="file_too_large",
        )


def sanitized_display_filename(client_filename: str) -> str:
    """Strip any path components from a client-supplied filename.

    Guards against both POSIX and Windows-style separators being smuggled in
    the multipart filename field, even though this value is never used to
    build a filesystem path.
    """
    name = (client_filename or "").replace("\\", "/")
    name = os.path.basename(name).strip()
    return name or "unnamed"


def generate_storage_key(display_filename: str) -> str:
    """Generate a random on-disk filename, preserving only the extension."""
    ext = Path(display_filename).suffix
    # Guard against a pathological/huge suffix being carried through.
    if len(ext) > 20:
        ext = ""
    return f"{uuid.uuid4().hex}{ext}"


def _storage_root() -> Path:
    root = Path(settings.attachment_storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_storage_path(storage_key: str) -> Path:
    root = _storage_root()
    path = (root / storage_key).resolve()
    # Defense in depth: storage_key is always our own generated uuid-based
    # name, but refuse to serve/delete anything that escapes the root.
    if root.resolve() not in path.parents and path != root.resolve():
        raise BadRequestException("Invalid storage key")
    return path


def validate_upload_size(size_bytes: int) -> None:
    if size_bytes <= 0:
        raise BadRequestException("Uploaded file is empty")
    max_bytes = settings.max_attachment_size_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise FileTooLargeError(settings.max_attachment_size_mb)


def save_file(data: bytes, storage_key: str) -> None:
    path = resolve_storage_path(storage_key)
    path.write_bytes(data)


def delete_file(storage_key: str) -> None:
    path = resolve_storage_path(storage_key)
    try:
        path.unlink()
    except FileNotFoundError:
        pass
