# Contributing to TeeDesk

TeeDesk is maintained by [Teevexa](https://www.teevexa.com). Thanks for considering a contribution.

## Before you start

- For anything non-trivial (a new feature, a change to the AI pipeline, a schema change), open an issue first to discuss the approach before writing code. It saves you a rewritten PR.
- For bug fixes and small improvements, a pull request is fine without a prior issue.
- Check open issues and pull requests first so you're not duplicating work already in progress.

## Development setup

See the [README](README.md#quick-start) for the full local setup (Docker infra, Python venv, Ollama model pull). In short:

```bash
bash scripts/setup.sh
bash scripts/dev.sh infra   # Postgres, Redis, Ollama
bash scripts/dev.sh pull    # pull the Mistral model
bash scripts/dev.sh api     # FastAPI on :8000
bash scripts/dev.sh web     # React app on :5173
```

## Making a change

1. Fork the repository and create a branch off `main`: `git checkout -b feat/my-feature`.
2. Make your change. Match the existing code style in the file you're editing rather than introducing a new pattern — this codebase has a consistent house style (dependency-injected services in routers, `verify_tenant_access`/`verify_conversation_access` for any tenant-scoped resource, structlog for backend logging).
3. If you touch the backend:
   - Add or update an Alembic migration for any schema change (`services/api/alembic/versions/`) — check the latest existing revision number first so you don't create two migrations claiming the same revision.
   - Run the test suite: `cd services/api && pytest tests/ -v`.
   - Run `ruff check app --select F,E9` — this is what CI checks.
4. If you touch the frontend (`apps/web` or `apps/widget`):
   - Run `npm run type-check` and `npm run lint` from the repo root.
5. Commit with a clear message (conventional-commit style is preferred but not required: `feat:`, `fix:`, `docs:`, `refactor:`).
6. Push and open a pull request against `main`. Describe what changed and why, not just what.

## Security-sensitive changes

Anything touching authentication, authorization (`verify_tenant_access`, `verify_conversation_access`, role checks), webhook signature verification, or rate limiting deserves extra scrutiny in review — this product has had real cross-tenant data-isolation bugs before. If you're fixing a vulnerability rather than adding a feature, see [SECURITY.md](SECURITY.md) instead of opening a public PR first.

## What we're not looking for right now

- New third-party integrations (Slack, SMS providers, additional channels beyond WhatsApp/Telegram) without discussing scope first — these tend to need ongoing maintenance commitment, not just an initial PR.
- Large refactors or rewrites without a prior issue discussion.

## Code of conduct

Be respectful and assume good faith. Disagreements about technical approach are fine and expected; personal attacks aren't. Maintainers may close issues/PRs that don't meet this bar without further discussion.
