"""Authentication endpoints — register, login, logout, refresh, password reset."""
from __future__ import annotations

from typing import Optional

import structlog
from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    EmailVerifyRequest,
    LoginRequest,
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from app.services import auth_service

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_REFRESH_COOKIE = "refresh_token"
_COOKIE_OPTS: dict = dict(
    httponly=True,
    secure=settings.is_production,
    samesite="lax",
    max_age=settings.refresh_token_expire_days * 24 * 3600,
    path="/api/v1/auth",
)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(_REFRESH_COOKIE, token, **_COOKIE_OPTS)


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(_REFRESH_COOKIE, path="/api/v1/auth")


def _client_ip(request: Request) -> Optional[str]:
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    data: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, raw_refresh = await auth_service.register(data, db)
    token_resp = auth_service._build_token_response(user)
    _set_refresh_cookie(response, raw_refresh)
    return token_resp.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@router.post("/login")
async def login(
    request: Request,
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, raw_refresh = await auth_service.login(
        data, db,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    token_resp = auth_service._build_token_response(user)
    _set_refresh_cookie(response, raw_refresh)
    return token_resp.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

@router.post("/logout")
async def logout(
    response: Response,
    body: Optional[RefreshRequest] = None,
    refresh_token: Optional[str] = Cookie(default=None, alias=_REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> dict:
    raw = (body.refresh_token if body else None) or refresh_token
    if raw:
        await auth_service.logout(raw, db)
    _clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

@router.post("/refresh")
async def refresh_tokens(
    response: Response,
    body: Optional[RefreshRequest] = None,
    refresh_token: Optional[str] = Cookie(default=None, alias=_REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> dict:
    raw = (body.refresh_token if body else None) or refresh_token
    if not raw:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": {"code": "unauthorized", "message": "Refresh token required"}},
        )
    user, new_raw = await auth_service.refresh_tokens(raw, db)
    token_resp = auth_service._build_token_response(user)
    _set_refresh_cookie(response, new_raw)
    return token_resp.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Current user (me)
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        created_at=current_user.created_at,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    updates = data.model_dump(exclude_none=True)
    if updates:
        await db.execute(update(User).where(User.id == current_user.id).values(**updates))
        await db.flush()
        await db.refresh(current_user)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        avatar_url=current_user.avatar_url,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        created_at=current_user.created_at,
    )


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------

@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await auth_service.change_password(current_user, data, db)
    _clear_refresh_cookie(response)
    return {"message": "Password changed successfully. Please log in again."}


# ---------------------------------------------------------------------------
# Password reset (unauthenticated)
# ---------------------------------------------------------------------------

@router.post("/forgot-password")
async def forgot_password(
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await auth_service.request_password_reset(data.email, db)
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    data: PasswordResetConfirm,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await auth_service.confirm_password_reset(data.token, data.new_password, db)
    _clear_refresh_cookie(response)
    return {"message": "Password reset successful. Please log in with your new password."}


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

@router.post("/verify-email")
async def verify_email(
    data: EmailVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await auth_service.verify_email(data.token, db)
    return {"message": "Email verified successfully."}


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if current_user.email_verified:
        return {"message": "Email is already verified."}
    from app.core.security import generate_urlsafe_token, token_expiry
    token = generate_urlsafe_token()
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(
            email_verification_token=token,
            email_verification_expires=token_expiry(hours=48),
        )
    )
    log.debug("email.resend_verification_token", token=token)
    return {"message": "Verification email sent."}
