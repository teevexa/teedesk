"""Authentication service — registration, login, token lifecycle, audit logging."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import (
    generate_refresh_token,
    generate_urlsafe_token,
    hash_password,
    hash_refresh_token,
    token_expiry,
    verify_password,
    create_access_token,
)
from app.models.auth import AuditLog, RefreshToken
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

log = structlog.get_logger(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 30


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _build_token_response(user: User, db_session: AsyncSession | None = None) -> TokenResponse:
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(user.tenant_id),
        role=user.role,
    )
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            tenant_id=user.tenant_id,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            email_verified=user.email_verified,
            created_at=user.created_at,
        ),
    )


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

async def register(data: RegisterRequest, db: AsyncSession) -> tuple[User, str]:
    """Create a tenant + admin user. Returns (user, raw_refresh_token)."""
    # Check slug uniqueness
    slug_result = await db.execute(select(Tenant).where(Tenant.slug == data.tenant_slug))
    if slug_result.scalar_one_or_none():
        raise ConflictException(f"Tenant slug '{data.tenant_slug}' is already taken")

    # Check email uniqueness (across all tenants for the slug context; here we check globally)
    email_result = await db.execute(select(User).where(User.email == data.email))
    if email_result.scalar_one_or_none():
        raise ConflictException("An account with this email already exists")

    # Create tenant
    tenant = Tenant(
        name=data.tenant_name,
        slug=data.tenant_slug,
        plan="free",
    )
    db.add(tenant)
    await db.flush()

    # Create admin user
    verification_token = generate_urlsafe_token()
    user = User(
        tenant_id=tenant.id,
        email=data.email,
        name=data.name or data.email.split("@")[0],
        role="admin",
        password_hash=hash_password(data.password),
        email_verified=False,
        email_verification_token=verification_token,
        email_verification_expires=token_expiry(hours=48),
    )
    db.add(user)
    await db.flush()

    raw_refresh = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=token_expiry(hours=settings.refresh_token_expire_days * 24),
    )
    db.add(rt)
    await db.flush()
    await db.refresh(user)

    log.info("user.registered", user_id=str(user.id), tenant_id=str(tenant.id))
    # In production: send verification email with `verification_token`
    log.debug("email.verification_token", token=verification_token)

    return user, raw_refresh


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

async def login(
    data: LoginRequest,
    db: AsyncSession,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[User, str]:
    """Authenticate user. Returns (user, raw_refresh_token)."""
    result = await db.execute(select(User).where(User.email == data.email, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    async def _audit(success: bool, detail: str) -> None:
        await _log_audit(
            db=db,
            action="auth.login",
            user_id=user.id if user else None,
            tenant_id=user.tenant_id if user else None,
            success=success,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"email": data.email, "detail": detail},
        )

    if user is None:
        await _audit(False, "user_not_found")
        raise BadRequestException("Invalid email or password")

    if not user.is_active:
        await _audit(False, "account_disabled")
        raise BadRequestException("Account is disabled")

    if user.is_locked:
        await _audit(False, "account_locked")
        raise BadRequestException("Account is temporarily locked due to too many failed attempts")

    if not user.password_hash or not verify_password(data.password, user.password_hash):
        # Increment failed attempts
        attempts = user.failed_login_attempts + 1
        updates: dict = {"failed_login_attempts": attempts}
        if attempts >= MAX_FAILED_ATTEMPTS:
            from datetime import timedelta
            updates["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        await db.execute(update(User).where(User.id == user.id).values(**updates))
        await _audit(False, "invalid_password")
        raise BadRequestException("Invalid email or password")

    # Reset failed attempts on success
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(failed_login_attempts=0, locked_until=None, last_login_at=datetime.now(timezone.utc))
    )

    raw_refresh = generate_refresh_token()
    expire_hours = settings.refresh_token_expire_days * 24 * (7 if data.remember_me else 1)
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=token_expiry(hours=expire_hours),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(rt)
    await db.flush()
    await db.refresh(user)

    await _audit(True, "success")
    return user, raw_refresh


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

async def refresh_tokens(raw_token: str, db: AsyncSession) -> tuple[User, str]:
    """Exchange a valid refresh token for a new access + refresh token pair."""
    token_hash = hash_refresh_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
        )
    )
    rt = result.scalar_one_or_none()

    if rt is None:
        raise BadRequestException("Invalid or expired refresh token")

    if rt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        # Revoke expired token
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.id == rt.id)
            .values(revoked=True, revoked_at=datetime.now(timezone.utc))
        )
        raise BadRequestException("Refresh token has expired. Please log in again.")

    # Revoke old token (rotation)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.id == rt.id)
        .values(revoked=True, revoked_at=datetime.now(timezone.utc))
    )

    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise BadRequestException("User not found or disabled")

    # Issue new refresh token
    new_raw = generate_refresh_token()
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(new_raw),
        expires_at=rt.expires_at,  # preserve original expiry
        ip_address=rt.ip_address,
        user_agent=rt.user_agent,
    )
    db.add(new_rt)
    await db.flush()
    await db.refresh(user)

    return user, new_raw


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

async def logout(raw_token: str, db: AsyncSession) -> None:
    """Revoke a refresh token."""
    token_hash = hash_refresh_token(raw_token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .values(revoked=True, revoked_at=datetime.now(timezone.utc))
    )


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

async def request_password_reset(email: str, db: AsyncSession) -> None:
    """Generate a password reset token (always returns success to prevent enumeration)."""
    result = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if user is None:
        log.info("password_reset.user_not_found", email=email)
        return  # Do NOT reveal existence

    token = generate_urlsafe_token()
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            password_reset_token=token,
            password_reset_expires=token_expiry(hours=1),
        )
    )
    # In production: send reset email with token
    log.info("password_reset.token_generated", user_id=str(user.id))
    log.debug("password_reset.token", token=token)


async def confirm_password_reset(token: str, new_password: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(User).where(
            User.password_reset_token == token,
            User.password_reset_expires > datetime.now(timezone.utc),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise BadRequestException("Invalid or expired password reset token")

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            password_hash=hash_password(new_password),
            password_reset_token=None,
            password_reset_expires=None,
            failed_login_attempts=0,
            locked_until=None,
        )
    )
    # Revoke all refresh tokens for security
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(revoked=True, revoked_at=datetime.now(timezone.utc))
    )
    log.info("password_reset.completed", user_id=str(user.id))


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

async def verify_email(token: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(User).where(
            User.email_verification_token == token,
            User.email_verification_expires > datetime.now(timezone.utc),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise BadRequestException("Invalid or expired verification token")

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            email_verified=True,
            email_verification_token=None,
            email_verification_expires=None,
        )
    )
    log.info("email.verified", user_id=str(user.id))


# ---------------------------------------------------------------------------
# Change password (authenticated)
# ---------------------------------------------------------------------------

async def change_password(user: User, data: ChangePasswordRequest, db: AsyncSession) -> None:
    if not user.password_hash or not verify_password(data.old_password, user.password_hash):
        raise BadRequestException("Current password is incorrect")

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(password_hash=hash_password(data.new_password))
    )
    # Revoke all refresh tokens to force re-login on other devices
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(revoked=True, revoked_at=datetime.now(timezone.utc))
    )


# ---------------------------------------------------------------------------
# Audit logging
# ---------------------------------------------------------------------------

async def _log_audit(
    db: AsyncSession,
    action: str,
    user_id: Optional[uuid.UUID] = None,
    tenant_id: Optional[uuid.UUID] = None,
    success: bool = True,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    entry = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
        details=details or {},
    )
    db.add(entry)
    await db.flush()


async def log_audit(
    db: AsyncSession,
    action: str,
    user: Optional[User] = None,
    **kwargs,
) -> None:
    """Public helper for routers to log audit events."""
    await _log_audit(
        db=db,
        action=action,
        user_id=user.id if user else None,
        tenant_id=user.tenant_id if user else None,
        **kwargs,
    )
