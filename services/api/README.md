# TeeDesk API Service

FastAPI backend for the TeeDesk platform. Provides REST + WebSocket APIs for the web and mobile frontends.

## Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI + Uvicorn |
| Database | PostgreSQL 16 + pgvector |
| Migrations | Alembic |
| Cache / Broker | Redis 7 |
| Auth | JWT (python-jose) |
| LLM | Ollama (local) |
| NLP | sentence-transformers, spaCy |
| Background jobs | Celery |
| Observability | structlog |

## Setup

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values

uvicorn app.main:app --reload --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Implemented

- [x] Database models (SQLAlchemy) + Alembic migrations
- [x] Auth router (register, login, refresh, password reset, email verification — real SMTP delivery)
- [x] Real-time chat — REST for CRUD (messages, conversations), WebSocket for live send/receive
- [x] Conversations, knowledge base (CRUD + search + PDF/DOCX ingestion), feedback, intents, attachments routers
- [x] Analytics + admin routers (user management, audit logs, tenant management)
- [x] Sentence-transformer intent classification + spaCy NER extraction
- [x] Ollama LLM response generation + RAG pipeline (embed → retrieve → generate)
- [x] Celery tasks — nightly incremental intent retraining from verified feedback
- [x] Human handoff queue (auto-escalation + agent claim/resolve)
- [x] Multi-tenancy — tenant-scoped data throughout, plus admin/super_admin tenant switching
- [x] Per-tenant settings (branding, AI pipeline toggles, channel enable/disable)
- [x] WhatsApp + Telegram webhooks

## Not Implemented

- [ ] Stripe / Flutterwave billing
- [ ] Outbound webhook dispatch, SMS alerts, Slack integration (settings fields exist and persist, but there's no delivery mechanism behind them yet)
