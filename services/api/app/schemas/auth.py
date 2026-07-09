from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import BaseSchema

UserRole = Literal["customer", "agent", "support_agent", "admin", "super_admin"]


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseSchema):
    email: EmailStr
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class RegisterRequest(BaseSchema):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: Optional[str] = Field(None, max_length=255)
    # Creates a new tenant (B2B self-service registration)
    tenant_name: str = Field(..., min_length=2, max_length=255)
    tenant_slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        from app.core.security import validate_password_strength
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class RefreshRequest(BaseSchema):
    refresh_token: Optional[str] = None  # also accepted via cookie


class PasswordResetRequest(BaseSchema):
    email: EmailStr


class PasswordResetConfirm(BaseSchema):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        from app.core.security import validate_password_strength
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class EmailVerifyRequest(BaseSchema):
    token: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseSchema):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        from app.core.security import validate_password_strength
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class UpdateProfileRequest(BaseSchema):
    name: Optional[str] = Field(None, max_length=255)
    avatar_url: Optional[str] = Field(None, max_length=512)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class UserResponse(BaseSchema):
    id: UUID
    email: Optional[str]
    name: Optional[str]
    role: str
    tenant_id: UUID
    avatar_url: Optional[str]
    is_active: bool
    email_verified: bool
    created_at: Any  # datetime — kept as Any to avoid import issues with __future__


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserResponse


class MessageResponse(BaseSchema):
    message: str


class AuditLogResponse(BaseSchema):
    id: UUID
    tenant_id: Optional[UUID]
    user_id: Optional[UUID]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    ip_address: Optional[str]
    success: bool
    details: dict
    created_at: Any
