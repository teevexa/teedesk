from __future__ import annotations
import uuid
from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TenantSettings(Base, TimestampMixin):
    """Per-tenant configuration for the admin Settings page.

    One row per tenant (tenant_id is the primary key). Rows are created
    lazily on first access via TenantSettingsService.get_or_create — there
    is no backfill migration, so a tenant with no row yet simply gets one
    with these defaults the first time anything asks for its settings.
    """

    __tablename__ = "tenant_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # General
    chat_title: Mapped[str] = mapped_column(String(255), nullable=False, default="AI Customer Support")
    welcome_message: Mapped[str] = mapped_column(
        Text, nullable=False, default="Hello! How can I help you today?"
    )
    business_hours: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC-5")
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    # AI configuration
    enable_sentiment_analysis: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_intent_detection: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_voice_support: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enable_auto_escalation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    response_delay_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    confidence_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.7)

    # Notifications
    email_notifications: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sms_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    desktop_notifications: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    urgent_issue_alert: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Integrations
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    telegram_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    slack_integration: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    webhook_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    def __repr__(self) -> str:
        return f"<TenantSettings tenant_id={self.tenant_id}>"
