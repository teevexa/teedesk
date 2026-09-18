"""Generic SMTP-based transactional email service.

Provider-agnostic — works with any standard SMTP server (Gmail app
password, Amazon SES SMTP endpoint, Postmark SMTP, a local mailhog/
maildev instance for dev, etc.). No vendor SDKs.

If `settings.smtp_host` is unset, emails are logged at `log.info`
instead of sent, so local dev without SMTP configured keeps working
exactly as before. If SMTP is configured but a send fails, the error
is logged as a warning and swallowed — a transient email outage must
never break registration/login/password-reset for the caller.
"""
from __future__ import annotations

from email.message import EmailMessage

import aiosmtplib
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

# Bounds how long a single send can block the calling request handler.
# request/register/reset endpoints call this inline (not backgrounded), so
# this must stay well under typical client/gateway timeouts even if the
# configured SMTP server is unresponsive.
_SEND_TIMEOUT_SECONDS = 10


# ---------------------------------------------------------------------------
# Low-level send
# ---------------------------------------------------------------------------

async def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Send a multipart/alternative (text + HTML) email.

    Never raises: if SMTP isn't configured, the content is logged instead
    of sent (dev-friendly fallback); if SMTP is configured but the send
    fails, the error is logged as a warning and this returns normally.
    """
    if not settings.smtp_host:
        log.info(
            "email.not_configured.logging_only",
            to=to_email,
            subject=subject,
            text_body=text_body,
        )
        return

    message = EmailMessage()
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username or None,
            password=settings.smtp_password or None,
            start_tls=settings.smtp_use_tls,
            timeout=_SEND_TIMEOUT_SECONDS,
        )
        log.info("email.sent", to=to_email, subject=subject)
    except Exception as exc:
        # Covers SMTP connection/auth errors as well as asyncio.TimeoutError
        # from the `timeout` above — a slow or unreachable SMTP server must
        # never fail (or noticeably delay) the calling request.
        log.warning("email.send_failed", to=to_email, subject=subject, error=str(exc))


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

def _wrap_html(title: str, body_html: str) -> str:
    return f"""\
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>{title}</title></head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#111827;padding:20px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:600;">TeeDesk</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#111827;font-size:15px;line-height:1.6;">
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;color:#9ca3af;font-size:12px;">
                If you didn't request this, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _button(url: str, label: str) -> str:
    return (
        f'<a href="{url}" '
        'style="display:inline-block;margin:20px 0;padding:12px 24px;'
        'background-color:#4f46e5;color:#ffffff;text-decoration:none;'
        'border-radius:6px;font-weight:600;">'
        f"{label}</a>"
    )


# ---------------------------------------------------------------------------
# Verification email
# ---------------------------------------------------------------------------

async def send_verification_email(to_email: str, name: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    subject = "Verify your TeeDesk email address"

    html_body = _wrap_html(
        subject,
        f"""
        <p>Hi {name},</p>
        <p>Thanks for signing up for TeeDesk. Please confirm your email address to activate your account.</p>
        {_button(link, "Verify email")}
        <p>Or paste this link into your browser:<br>
        <span style="word-break:break-all;color:#4f46e5;">{link}</span></p>
        <p>This link expires in 48 hours.</p>
        """,
    )
    text_body = (
        f"Hi {name},\n\n"
        "Thanks for signing up for TeeDesk. Please confirm your email address "
        f"by visiting the link below:\n\n{link}\n\n"
        "This link expires in 48 hours.\n"
    )

    await send_email(to_email, subject, html_body, text_body)


# ---------------------------------------------------------------------------
# Password reset email
# ---------------------------------------------------------------------------

async def send_password_reset_email(to_email: str, name: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    subject = "Reset your TeeDesk password"

    html_body = _wrap_html(
        subject,
        f"""
        <p>Hi {name},</p>
        <p>We received a request to reset your TeeDesk password. Click the button below to choose a new one.</p>
        {_button(link, "Reset password")}
        <p>Or paste this link into your browser:<br>
        <span style="word-break:break-all;color:#4f46e5;">{link}</span></p>
        <p>This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.</p>
        """,
    )
    text_body = (
        f"Hi {name},\n\n"
        "We received a request to reset your TeeDesk password. Visit the link "
        f"below to choose a new one:\n\n{link}\n\n"
        "This link expires in 1 hour. If you didn't request a password reset, "
        "you can ignore this email.\n"
    )

    await send_email(to_email, subject, html_body, text_body)
