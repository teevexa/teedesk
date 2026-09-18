# Security Policy

## Supported versions

TeeDesk does not yet have tagged releases — security fixes are applied to `main`. Once versioned releases exist, this section will list which versions receive backported fixes.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately:

- Email: teevexa@gmail.com
- Alternatively, use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) on this repository, once enabled.

Include:
- A description of the vulnerability and its impact.
- Steps to reproduce (a minimal repro is ideal).
- Which component is affected (backend API, web app, widget, WhatsApp/Telegram webhook handling, etc.).

We'll acknowledge reports within a few business days and aim to have a fix or mitigation plan communicated within 2 weeks for confirmed issues, sooner for anything critical (auth bypass, cross-tenant data access, RCE).

## Scope

In scope:
- The FastAPI backend (`services/api`) — authentication, authorization, tenant isolation, webhook signature verification, rate limiting, and data handling.
- The web app and embeddable widget (`apps/web`, `apps/widget`) — XSS, auth token handling, CSRF-relevant flows.
- The Docker/Kubernetes deployment configs (`infrastructure/`) — misconfiguration that would expose services or credentials by default.

Out of scope:
- Vulnerabilities that require an attacker to already have valid admin/super_admin credentials for the target tenant and are doing something the role is intentionally permitted to do.
- Denial-of-service via brute-force volume alone against a deployment that hasn't configured rate limiting (see `TRUSTED_PROXY_COUNT` in the README — this is a deployment configuration concern, not a code vulnerability, unless the default configuration itself is unsafe).
- Issues in third-party dependencies — please report those upstream, though we appreciate a heads-up if TeeDesk is affected.

## For self-hosters

If you're running your own TeeDesk instance, see the [README's deployment section](README.md#deployment) — in particular, use `docker-compose.prod.yml` (not the dev compose file) for anything reachable from the public internet, and make sure `SECRET_KEY`, `POSTGRES_PASSWORD`, and `REDIS_PASSWORD` are real generated secrets, not the example placeholders.
