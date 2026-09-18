"""Enforce global email uniqueness for active users

login()/register() already treat email as globally unique (login looks a
user up by email alone, with no tenant in scope yet), but the DB only had
a non-unique (tenant_id, email) index — concurrent registrations with the
same email could both succeed, and login() would then crash with
MultipleResultsFound instead of returning "invalid credentials".

Revision ID: 004
Revises: 003
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Partial unique index: only active (non-soft-deleted) users with a real
    # email must be unique — soft-deleted accounts free up their email, and
    # NULL emails (should there ever be any) are never compared as equal.
    op.execute(
        "CREATE UNIQUE INDEX ix_users_email_unique ON users (email) "
        "WHERE email IS NOT NULL AND deleted_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_email_unique")
