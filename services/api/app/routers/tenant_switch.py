"""Tenant switching — list the tenants a user can act as, and mint a
session-scoped access token for one of them.

A user's home tenant (`User.tenant_id`) never changes here. Switching only
mints a new *access* token whose `tenant_id`/`role` claims point at the
target tenant; `app.core.auth.get_current_user` reads those claims and
overrides the loaded user's in-memory `tenant_id`/`role` for the rest of
the request, so every existing tenant-scoped router keeps working without
modification. The existing refresh token is left untouched — see
app/models/auth.py's `RefreshToken`, which isn't tenant-scoped, so there is
nothing about it that needs to change when the active tenant changes.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ForbiddenError, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.models.user import User
from app.schemas.auth import TokenResponse, UserResponse
from app.schemas.tenant import MyTenantResponse, SwitchTenantRequest

log = structlog.get_logger(__name__)

router = APIRouter(tags=["Tenant Switching"])


@router.get("/my-tenants", response_model=list[MyTenantResponse])
async def list_my_tenants(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MyTenantResponse]:
    """The caller's home tenant plus every tenant they hold a membership in."""
    home_result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    home_tenant = home_result.scalar_one_or_none()

    tenants: list[MyTenantResponse] = []
    if home_tenant is not None:
        tenants.append(
            MyTenantResponse(
                id=home_tenant.id,
                name=home_tenant.name,
                slug=home_tenant.slug,
                role=current_user.role,
            )
        )

    m_result = await db.execute(
        select(TenantMembership, Tenant)
        .join(Tenant, Tenant.id == TenantMembership.tenant_id)
        .where(TenantMembership.user_id == current_user.id)
    )
    for membership, tenant in m_result.all():
        tenants.append(
            MyTenantResponse(id=tenant.id, name=tenant.name, slug=tenant.slug, role=membership.role)
        )

    return tenants


@router.post("/switch-tenant", response_model=TokenResponse)
async def switch_tenant(
    data: SwitchTenantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Mint a new access token scoped to another tenant the caller has access to.

    The caller must either own `data.tenant_id` as their home tenant, or
    hold a `TenantMembership` row for it — 403 otherwise. Only a new access
    token is minted (see module docstring for why the refresh token is left
    alone); the response has the same `TokenResponse` shape as login/refresh.
    """
    # NOTE: current_user.tenant_id here is already the *active* tenant for
    # this request (see app.core.auth.get_current_user) — but a switch
    # should always be evaluated against the user's real home tenant, so we
    # look that up directly from the DB rather than trusting the possibly
    # already-switched in-memory value.
    home_result = await db.execute(select(User.tenant_id).where(User.id == current_user.id))
    home_tenant_id = home_result.scalar_one()

    if data.tenant_id == home_tenant_id:
        # current_user.role may already have been overridden by an
        # already-active switch (see get_current_user); the caller's *home*
        # role is what should apply when switching back home, so fetch it
        # fresh instead of trusting the possibly-overridden in-memory value.
        role_result = await db.execute(select(User.role).where(User.id == current_user.id))
        role = role_result.scalar_one()
    else:
        m_result = await db.execute(
            select(TenantMembership).where(
                TenantMembership.user_id == current_user.id,
                TenantMembership.tenant_id == data.tenant_id,
            )
        )
        membership = m_result.scalar_one_or_none()
        if membership is None:
            raise ForbiddenError("You do not have access to this tenant")
        role = membership.role

    access_token = create_access_token(
        subject=str(current_user.id),
        tenant_id=str(data.tenant_id),
        role=role,
    )

    log.info(
        "tenant.switched",
        user_id=str(current_user.id),
        tenant_id=str(data.tenant_id),
        role=role,
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserResponse(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            role=role,
            tenant_id=data.tenant_id,
            avatar_url=current_user.avatar_url,
            is_active=current_user.is_active,
            email_verified=current_user.email_verified,
            created_at=current_user.created_at,
        ),
    )
