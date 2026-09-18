"""Add tenant_memberships table — backs multi-tenant switching for admins

A user's home tenant (users.tenant_id) is unchanged and remains implicit —
it is NOT backfilled into this table. A row here only represents an
*additional* tenant a user has been explicitly granted access to, so no
data migration is needed: "is this the user's home tenant" is always
implicitly true without a membership row, and only additional tenants
require one.

Revision ID: 005
Revises: 004
Create Date: 2026-09-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenant_memberships",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", ENUM(name="user_role", create_type=False), nullable=False, server_default="agent"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_tenant_memberships_user_id", "tenant_memberships", ["user_id"])
    op.create_index("ix_tenant_memberships_tenant_id", "tenant_memberships", ["tenant_id"])
    op.create_unique_constraint(
        "uq_tenant_memberships_user_tenant", "tenant_memberships", ["user_id", "tenant_id"]
    )


def downgrade() -> None:
    op.drop_table("tenant_memberships")
