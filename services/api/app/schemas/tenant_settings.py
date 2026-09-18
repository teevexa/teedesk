from __future__ import annotations
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampSchema


class TenantSettingsResponse(TimestampSchema):
    tenant_id: UUID

    chat_title: str
    welcome_message: str
    business_hours: str | None
    timezone: str
    language: str

    enable_sentiment_analysis: bool
    enable_intent_detection: bool
    enable_voice_support: bool
    enable_auto_escalation: bool
    response_delay_ms: int
    confidence_threshold: float

    email_notifications: bool
    sms_alerts: bool
    desktop_notifications: bool
    urgent_issue_alert: bool

    whatsapp_enabled: bool
    telegram_enabled: bool
    slack_integration: bool
    webhook_url: str | None


class TenantSettingsUpdate(BaseSchema):
    """All fields optional — PATCH applies only what's provided."""

    chat_title: str | None = Field(None, min_length=1, max_length=255)
    welcome_message: str | None = Field(None, min_length=1)
    business_hours: str | None = Field(None, max_length=255)
    timezone: str | None = Field(None, max_length=50)
    language: str | None = Field(None, max_length=10)

    enable_sentiment_analysis: bool | None = None
    enable_intent_detection: bool | None = None
    enable_voice_support: bool | None = None
    enable_auto_escalation: bool | None = None
    response_delay_ms: int | None = Field(None, ge=0)
    confidence_threshold: float | None = Field(None, ge=0.0, le=1.0)

    email_notifications: bool | None = None
    sms_alerts: bool | None = None
    desktop_notifications: bool | None = None
    urgent_issue_alert: bool | None = None

    whatsapp_enabled: bool | None = None
    telegram_enabled: bool | None = None
    slack_integration: bool | None = None
    webhook_url: str | None = Field(None, max_length=512)
