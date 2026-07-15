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

## Implementation Roadmap

- [ ] Database models (SQLAlchemy)
- [ ] Alembic migrations
- [ ] Auth router (register, login, refresh)
- [ ] Chat router (WebSocket + REST)
- [ ] Conversations router
- [ ] Knowledge base router (CRUD + search)
- [ ] Analytics router
- [ ] Admin router
- [ ] Sentence-transformer intent classification
- [ ] spaCy NER extraction
- [ ] Ollama LLM response generation
- [ ] RAG pipeline (embed → retrieve → generate)
- [ ] Celery tasks (model inference, retraining)
- [ ] Human handoff queue
- [ ] Multi-tenancy middleware
- [ ] WhatsApp / Telegram webhooks
