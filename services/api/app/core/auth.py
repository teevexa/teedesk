"""FastAPI dependency factories for authentication and authorization."""
from __future__ import annotations

import uuid
from typing import Optional

import structlog
from fastapi import Cookie, Depends, Header, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import SupportIQError
from app.core.security import decode_access_token
from app.models.user import ADMIN_ROLES, AGENT_ROLES, User

log = structlog.get_logger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


class AuthError(SupportIQError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message)
        self.headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(SupportIQError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"

    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__(message)


# ---------------------------------------------------------------------------
# Token extraction — try Authorization header, then cookie
# ---------------------------------------------------------------------------

def _extract_token(
    credentials: Optional[HTTPAuthorizationCredentials],
    access_token_cookie: Optional[str],
) -> Optional[str]:
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return access_token_cookie


# ---------------------------------------------------------------------------
# Core user dependency
# ---------------------------------------------------------------------------

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(credentials, access_token)
    if not token:
        raise AuthError()

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("Invalid token payload")
    except JWTError as exc:
        raise AuthError(f"Invalid or expired token: {exc}") from exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthError("User not found")
    if not user.is_active:
        raise AuthError("Account is disabled")
    if user.is_locked:
        raise AuthError("Account is temporarily locked")

    # Expose user on request state for middleware/audit access
    request.state.user = user
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user


# ---------------------------------------------------------------------------
# Optional auth — returns None if no token present (for public routes)
# ---------------------------------------------------------------------------

async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    token = _extract_token(credentials, access_token)
    if not token:
        return None
    try:
        return await get_current_user(request, credentials, access_token, db)
    except AuthError:
        return None


# ---------------------------------------------------------------------------
# Role-based access control factories
# ---------------------------------------------------------------------------

def require_roles(*roles: str):
    """Dependency factory — raises 403 if user's role is not in `roles`."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise ForbiddenError(
                f"Role '{current_user.role}' is not permitted. Required: {list(roles)}"
            )
        return current_user
    return _check


def require_agent():
    """Require agent, support_agent, admin, or super_admin."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in AGENT_ROLES:
            raise ForbiddenError("Agent or admin role required")
        return current_user
    return _check


def require_admin():
    """Require admin or super_admin."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in ADMIN_ROLES:
            raise ForbiddenError("Admin role required")
        return current_user
    return _check


def require_super_admin():
    """Require super_admin only."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != "super_admin":
            raise ForbiddenError("Super admin role required")
        return current_user
    return _check


# ---------------------------------------------------------------------------
# Tenant isolation helper
# ---------------------------------------------------------------------------

def get_tenant_id(current_user: User = Depends(get_current_user)) -> uuid.UUID:
    """Returns the tenant_id from the authenticated user."""
    return current_user.tenant_id


def verify_tenant_access(resource_tenant_id: uuid.UUID, user: User) -> None:
    """Raise 403 if user tries to access another tenant's resource."""
    if user.role == "super_admin":
        return  # super_admin can access any tenant
    if resource_tenant_id != user.tenant_id:
        raise ForbiddenError("Access denied: resource belongs to a different tenant")
