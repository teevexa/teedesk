"""Admin-only endpoints — user management, audit logs, tenant overview."""
import uuid
from typing import Annotated, Optional

import structlog
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_admin, require_super_admin, verify_tenant_access
from app.core.database import get_db
from app.core.exceptions import NotFoundException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.models.auth import AuditLog
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import AuditLogResponse, UserResponse
from app.services.auth_service import log_audit

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users", response_model=PaginatedResponse[UserResponse])
async def list_users(
    tenant_id: Optional[uuid.UUID] = Query(default=None),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[UserResponse]:
    q = select(User).where(User.deleted_at.is_(None))

    # super_admin can see all tenants; admin only sees own tenant
    if current_user.role != "super_admin":
        q = q.where(User.tenant_id == current_user.tenant_id)
    elif tenant_id:
        q = q.where(User.tenant_id == tenant_id)

    if role:
        q = q.where(User.role == role)
    if is_active is not None:
        q = q.where(User.is_active == is_active)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(q.offset(pagination.offset).limit(pagination.size))
    users = result.scalars().all()

    items = [
        UserResponse(
            id=u.id, email=u.email, name=u.name, role=u.role,
            tenant_id=u.tenant_id, avatar_url=u.avatar_url,
            is_active=u.is_active, email_verified=u.email_verified,
            created_at=u.created_at,
        )
        for u in users
    ]
    pages = max(1, (total + pagination.size - 1) // pagination.size)
    return PaginatedResponse(
        items=items, total=total, page=pagination.page,
        size=pagination.size, pages=pages,
        has_next=pagination.page < pages, has_prev=pagination.page > 1,
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")
    if current_user.role != "super_admin":
        verify_tenant_access(user.tenant_id, current_user)
    return UserResponse(
        id=user.id, email=user.email, name=user.name, role=user.role,
        tenant_id=user.tenant_id, avatar_url=user.avatar_url,
        is_active=user.is_active, email_verified=user.email_verified,
        created_at=user.created_at,
    )


class UserUpdateRequest:
    pass


from pydantic import BaseModel
from typing import Literal


class AdminUserUpdate(BaseModel):
    role: Optional[Literal["customer", "agent", "support_agent", "admin"]] = None
    is_active: Optional[bool] = None
    name: Optional[str] = None


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")
    if current_user.role != "super_admin":
        verify_tenant_access(user.tenant_id, current_user)
    # Admin cannot promote to super_admin; super_admin can set any role
    if data.role == "super_admin" and current_user.role != "super_admin":
        from app.core.auth import ForbiddenError
        raise ForbiddenError("Only super_admin can assign super_admin role")

    updates = data.model_dump(exclude_none=True)
    if updates:
        await db.execute(update(User).where(User.id == user_id).values(**updates))
        await db.flush()
        await db.refresh(user)

    await log_audit(db, "admin.user.update", user=current_user,
                    resource_type="user", resource_id=str(user_id),
                    details=updates)

    return UserResponse(
        id=user.id, email=user.email, name=user.name, role=user.role,
        tenant_id=user.tenant_id, avatar_url=user.avatar_url,
        is_active=user.is_active, email_verified=user.email_verified,
        created_at=user.created_at,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    from datetime import datetime, timezone
    from fastapi.responses import Response as FastAPIResponse
    await db.execute(
        update(User).where(User.id == user_id).values(
            deleted_at=datetime.now(timezone.utc), is_active=False
        )
    )
    await log_audit(db, "admin.user.delete", user=current_user,
                    resource_type="user", resource_id=str(user_id))
    return FastAPIResponse(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Tenant management (super_admin only)
# ---------------------------------------------------------------------------

class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    created_at: object


@router.get("/tenants", response_model=PaginatedResponse[TenantResponse])
async def list_tenants(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_super_admin()),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[TenantResponse]:
    total_result = await db.execute(select(func.count()).select_from(Tenant))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Tenant).offset(pagination.offset).limit(pagination.size)
    )
    tenants = result.scalars().all()

    items = [
        TenantResponse(id=t.id, name=t.name, slug=t.slug, plan=t.plan,
                       is_active=t.is_active, created_at=t.created_at)
        for t in tenants
    ]
    pages = max(1, (total + pagination.size - 1) // pagination.size)
    return PaginatedResponse(
        items=items, total=total, page=pagination.page,
        size=pagination.size, pages=pages,
        has_next=pagination.page < pages, has_prev=pagination.page > 1,
    )


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=PaginatedResponse[AuditLogResponse])
async def list_audit_logs(
    action: Optional[str] = Query(default=None),
    user_id: Optional[uuid.UUID] = Query(default=None),
    success: Optional[bool] = Query(default=None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AuditLogResponse]:
    q = select(AuditLog)

    if current_user.role != "super_admin":
        q = q.where(AuditLog.tenant_id == current_user.tenant_id)
    if action:
        q = q.where(AuditLog.action == action)
    if user_id:
        q = q.where(AuditLog.user_id == user_id)
    if success is not None:
        q = q.where(AuditLog.success == success)

    q = q.order_by(AuditLog.created_at.desc())

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(q.offset(pagination.offset).limit(pagination.size))
    logs = result.scalars().all()

    items = [
        AuditLogResponse(
            id=entry.id, tenant_id=entry.tenant_id, user_id=entry.user_id,
            action=entry.action, resource_type=entry.resource_type,
            resource_id=entry.resource_id, ip_address=entry.ip_address,
            success=entry.success, details=entry.details, created_at=entry.created_at,
        )
        for entry in logs
    ]
    pages = max(1, (total + pagination.size - 1) // pagination.size)
    return PaginatedResponse(
        items=items, total=total, page=pagination.page,
        size=pagination.size, pages=pages,
        has_next=pagination.page < pages, has_prev=pagination.page > 1,
    )


# ---------------------------------------------------------------------------
# Analytics overview (admin+)
# ---------------------------------------------------------------------------

@router.get("/analytics")
async def get_admin_analytics(
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.models.conversation import Conversation
    from app.models.message import Message

    tenant_filter = (
        [] if current_user.role == "super_admin"
        else [Conversation.tenant_id == current_user.tenant_id]
    )

    conv_total = await db.execute(
        select(func.count()).where(Conversation.deleted_at.is_(None), *tenant_filter)
    )
    conv_open = await db.execute(
        select(func.count()).where(
            Conversation.deleted_at.is_(None),
            Conversation.status == "open",
            *tenant_filter,
        )
    )
    conv_escalated = await db.execute(
        select(func.count()).where(
            Conversation.deleted_at.is_(None),
            Conversation.status == "escalated",
            *tenant_filter,
        )
    )
    user_count = await db.execute(
        select(func.count()).where(
            User.deleted_at.is_(None),
            *([User.tenant_id == current_user.tenant_id] if current_user.role != "super_admin" else []),
        )
    )

    return {
        "conversations": {
            "total": conv_total.scalar_one(),
            "open": conv_open.scalar_one(),
            "escalated": conv_escalated.scalar_one(),
        },
        "users": user_count.scalar_one(),
    }


# ---------------------------------------------------------------------------
# Fine-tuning — retrain intent classifier from feedback
# ---------------------------------------------------------------------------

@router.post("/retrain", tags=["Admin"])
async def trigger_retrain(
    current_user: Annotated[User, Depends(require_admin())],
    all_tenants: bool = Query(False, description="super_admin only — retrain all tenants"),
) -> dict:
    """Dispatch a Celery task to promote verified TrainingData into Intent examples.

    Use all_tenants=true (super_admin only) to retrain every active tenant at once.
    Otherwise retrains only the caller's tenant.
    """
    from app.tasks.retrain import retrain_all_tenants, retrain_tenant

    if all_tenants:
        if current_user.role != "super_admin":
            from app.core.exceptions import TeeDeskError
            from fastapi import status as http_status
            raise TeeDeskError("Only super_admin can retrain all tenants")
        task = retrain_all_tenants.delay()
    else:
        task = retrain_tenant.delay(str(current_user.tenant_id))

    return {"task_id": task.id, "status": "queued"}


@router.get("/training-data", tags=["Admin"])
async def list_training_data(
    current_user: Annotated[User, Depends(require_admin())],
    db: AsyncSession = Depends(get_db),
    is_verified: bool | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> dict:
    """List training data entries for review and verification."""
    from sqlalchemy import select as sa_select
    from app.models.training_data import TrainingData

    stmt = sa_select(TrainingData).where(TrainingData.tenant_id == current_user.tenant_id)
    if is_verified is not None:
        stmt = stmt.where(TrainingData.is_verified == is_verified)
    stmt = stmt.order_by(TrainingData.created_at.desc()).offset((page - 1) * size).limit(size)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return {
        "items": [
            {
                "id": str(r.id),
                "input_text": r.input_text,
                "labeled_intent": r.labeled_intent,
                "labeled_sentiment": r.labeled_sentiment,
                "is_verified": r.is_verified,
                "source": r.source,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "page": page,
        "size": size,
    }


@router.patch("/training-data/{entry_id}/verify", tags=["Admin"])
async def verify_training_entry(
    entry_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_admin())],
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark a training data entry as verified, making it eligible for the next retrain."""
    from sqlalchemy import update as sa_update
    from app.models.training_data import TrainingData

    await db.execute(
        sa_update(TrainingData)
        .where(TrainingData.id == entry_id, TrainingData.tenant_id == current_user.tenant_id)
        .values(is_verified=True, verified_by=current_user.id)
    )
    await db.commit()
    return {"id": str(entry_id), "is_verified": True}
