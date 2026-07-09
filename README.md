# SupportIQ

**Production-grade AI customer support infrastructure.** Open-source, self-hostable, zero paid AI APIs.

---

## What Is SupportIQ?

SupportIQ is a full-stack AI support platform with:

- **Real-time chat** — WebSocket-powered with typing indicators, voice input/output, and message feedback
- **AI NLP pipeline** — sentence-transformers intent classification, spaCy NER, local LLM responses via Ollama
- **RAG knowledge base** — embed documents, retrieve context, generate grounded answers
- **Analytics dashboard** — live sentiment distribution, intent trends, escalation tracking
- **Human handoff** — escalate conversations to live agents when AI confidence is low
- **Multi-tenancy** — white-label SaaS architecture with tenant-scoped data
- **Multi-channel** — Web widget (embeddable), WhatsApp Business API, Telegram (planned)
- **Fine-tuning loop** — feedback-driven intent retraining via Celery

All AI runs locally. No OpenAI. No Anthropic. No paid APIs required.

---

## Repository Structure

```
supportiq/
├── apps/
│   ├── web/              React + Vite + TypeScript + Tailwind + shadcn/ui
│   └── widget/           Embeddable chat widget (IIFE bundle, drop-in script tag)
├── packages/
│   └── shared-types/     TypeScript interfaces shared across all apps
├── services/
│   ├── api/              FastAPI backend (Python) — REST + WebSocket
│   └── inference/        Ollama local LLM config and Modelfile
├── infrastructure/
│   └── docker/           docker-compose for local dev (Postgres, Redis, Ollama, Qdrant)
├── scripts/              Developer utility scripts
├── .github/workflows/    CI/CD pipeline
├── turbo.json            Turborepo build orchestration
├── tsconfig.base.json    Shared TypeScript config
└── .prettierrc           Shared code formatting
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Monorepo | Turborepo + npm workspaces | Build orchestration |
| Web Frontend | React 18 + Vite + TypeScript | Chat UI, Admin Dashboard |
| State | Zustand | Global client state |
| Data Fetching | TanStack Query + Axios | API integration |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | Design system |
| Backend | FastAPI + Uvicorn (Python) | REST + WebSocket API |
| Database | PostgreSQL 16 + pgvector | Conversations + vector search |
| Cache | Redis 7 | Sessions, rate limiting, Celery broker |
| LLM | Ollama (Mistral 7B / Llama 3.1) | Local response generation |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) | RAG + intent classification |
| NER | spaCy | Named entity extraction |
| Vector DB | pgvector (or Qdrant) | Knowledge base retrieval |
| Background Jobs | Celery | Intent retraining from feedback |
| Widget | Vanilla JS (IIFE, Vite build) | Embeddable customer chat widget |
| WhatsApp | Meta Cloud API + webhooks | WhatsApp Business channel |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker + Docker Compose

### 1. Clone and Setup

```bash
git clone https://github.com/benjaminbaya/supportiq.git
cd supportiq
bash scripts/setup.sh
```

### 2. Start Infrastructure (Docker)

```bash
bash scripts/dev.sh infra
# Starts: PostgreSQL, Redis, Ollama, Qdrant
```

### 3. Pull an LLM Model

```bash
bash scripts/dev.sh pull
# Pulls: mistral:7b-instruct + nomic-embed-text
```

### 4. Start the Web App

```bash
bash scripts/dev.sh web
# Open: http://localhost:5173
```

### 5. Start the API (optional, enables full AI features)

```bash
bash scripts/dev.sh api
# API runs at: http://localhost:8000
# Docs at:     http://localhost:8000/docs
```

### 6. Start the Celery worker (optional, enables background retraining)

The fine-tuning pipeline runs as a Celery background job. Start the worker and
beat scheduler in two separate terminals from `services/api/`:

```bash
# Terminal A — task worker
celery -A app.tasks.celery_app worker --loglevel=info

# Terminal B — beat scheduler (nightly auto-retrain)
celery -A app.tasks.celery_app beat --loglevel=info
```

Requires Redis to be running (`bash scripts/dev.sh infra`). Without the worker,
manual retraining via the admin UI returns a task ID but nothing executes.

---

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start all apps (Turborepo) |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all packages |
| `npm run type-check` | TypeScript check all packages |
| `npm run format` | Format all files with Prettier |
| `bash scripts/dev.sh infra` | Start Docker infrastructure |
| `bash scripts/dev.sh web` | Start web frontend only |
| `bash scripts/dev.sh api` | Start FastAPI backend only |
| `bash scripts/dev.sh pull` | Pull Ollama models |
| `bash scripts/dev.sh reset` | Reset Docker volumes |
| `celery -A app.tasks.celery_app worker` | Start Celery task worker |
| `celery -A app.tasks.celery_app beat` | Start Celery beat scheduler |

---

## Environment Variables

### Web App (`apps/web/.env.local`)

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_APP_NAME=SupportIQ
```

### API Service (`services/api/.env`)

See [services/api/.env.example](services/api/.env.example) for the full list.

Key variables:
```env
DATABASE_URL=postgresql+asyncpg://supportiq:supportiq_dev@localhost:5432/supportiq
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-very-long-secret-key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:7b-instruct
```

---

## Implementation Status

### Done
- [x] Monorepo architecture (Turborepo + npm workspaces)
- [x] React web frontend — chat UI, admin dashboard, agent queue, analytics, knowledge base
- [x] Voice input/output (Web Speech API)
- [x] Real-time WebSocket — typing indicators, presence, optimistic messages, auto-reconnect
- [x] FastAPI backend — auth (JWT + refresh), all REST endpoints, WebSocket chat
- [x] PostgreSQL schema + Alembic migrations
- [x] Full AI pipeline — embedding → sentiment → NER → intent classification → RAG → LLM
- [x] Ollama LLM integration (Mistral 7B, local, zero API cost)
- [x] RAG knowledge base (pgvector cosine similarity retrieval)
- [x] Multi-tenancy — all data scoped to `tenant_id`, role-based access (customer / agent / admin / super_admin)
- [x] Human handoff — auto-escalation on negative sentiment, agent claim/resolve flow
- [x] Analytics API — conversation stats, sentiment distribution, intent trends
- [x] Email verification + password reset flows (frontend + backend)
- [x] Docker Compose dev infrastructure (Postgres, Redis, Ollama, Qdrant)
- [x] CI/CD pipeline (GitHub Actions)
- [x] Shared TypeScript types package

### In Progress
- [ ] Embeddable chat widget (IIFE bundle for third-party sites)
- [ ] WhatsApp Business API integration (Meta Cloud API webhooks)
- [ ] Fine-tuning pipeline — feedback-driven intent retraining via Celery

### Planned
- [ ] Telegram bot integration
- [ ] Stripe / Flutterwave billing for SaaS deployment

---

## Open-Source AI Stack

All AI components are free and run locally:

| Component | Model / Library | Size |
|---|---|---|
| LLM | Mistral 7B Instruct (via Ollama) | 4.1 GB |
| Embeddings | all-MiniLM-L6-v2 (sentence-transformers) | 22 MB |
| NER | spaCy en_core_web_sm | 12 MB |
| Sentiment | cardiffnlp/twitter-roberta (server-side) | 499 MB |
| Vector DB | pgvector (PostgreSQL extension) | — |

---

## Deployment

### Free/Low-Cost Cloud

| Service | Provider | Cost |
|---|---|---|
| Web Frontend | Vercel | Free |
| PostgreSQL | Supabase / Neon | Free tier |
| Redis | Upstash | Free tier (10k req/day) |
| Backend API | Railway / Render | ~$5/month |
| LLM Inference | Hugging Face Spaces (GPU) | Free tier |

### Self-Hosted (recommended for privacy)

```bash
cd infrastructure/docker
docker compose up -d
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a pull request

---

Built with care for the developer community. No vendor lock-in. No paid AI APIs.
