"""Add tenant_settings table

Backs the admin Settings page (apps/web/src/components/admin/SettingsPanel.tsx),
which previously stored every field in local React state only and discarded
it on reload. One row per tenant; rows are created lazily on first access
(see TenantSettingsService.get_or_create), so no data backfill is needed here.

Revision ID: 006
Revises: 005
Create Date: 2026-09-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenant_settings",
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("chat_title", sa.String(255), nullable=False, server_default="AI Customer Support"),
        sa.Column(
            "welcome_message",
            sa.Text,
            nullable=False,
            server_default="Hello! How can I help you today?",
        ),
        sa.Column("business_hours", sa.String(255), nullable=True),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC-5"),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("enable_sentiment_analysis", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("enable_intent_detection", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("enable_voice_support", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("enable_auto_escalation", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("response_delay_ms", sa.Integer, nullable=False, server_default="1000"),
        sa.Column("confidence_threshold", sa.Float, nullable=False, server_default="0.7"),
        sa.Column("email_notifications", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sms_alerts", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("desktop_notifications", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("urgent_issue_alert", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("whatsapp_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("telegram_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("slack_integration", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("webhook_url", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # Reuse the update_updated_at() trigger function created in 001_initial_schema.
    op.execute(
        """
        CREATE TRIGGER trg_tenant_settings_updated_at
        BEFORE UPDATE ON tenant_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_tenant_settings_updated_at ON tenant_settings")
    op.drop_table("tenant_settings")
