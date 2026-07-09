"""Add message status enum + attachments table

Revision ID: 003
Revises: 002
Create Date: 2026-05-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # message_status enum
    op.execute("CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read')")

    # status column on messages
    op.add_column(
        "messages",
        sa.Column(
            "status",
            ENUM(name="message_status", create_type=False),
            nullable=False,
            server_default="sent",
        ),
    )

    # attachments table
    op.create_table(
        "attachments",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "message_id",
            UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("storage_key", sa.Text, nullable=False),
        sa.Column("url", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    # Explicit indexes (no index=True on columns above to avoid auto-duplication)
    op.execute("CREATE INDEX ix_attachments_message_id ON attachments (message_id)")
    op.execute("CREATE INDEX ix_attachments_tenant_id ON attachments (tenant_id)")


def downgrade() -> None:
    op.drop_table("attachments")
    op.drop_column("messages", "status")
    op.execute("DROP TYPE message_status")
