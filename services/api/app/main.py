from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import limiter
from app.routers import admin, analytics, auth, conversations, escalations, feedback, health, intents, knowledge, messages, widget, whatsapp
from app.routers import websocket as ws_router

configure_logging()
log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    log.info("SupportIQ API starting", environment=settings.environment)

    # Start Redis pub/sub listener for cross-process WS broadcast
    from app.core.connection_manager import manager
    from app.core.redis_client import get_redis, close_redis

    try:
        redis = get_redis()
        await manager.start(redis)
        log.info("ws.connection_manager.started")
    except Exception as exc:
        log.warning("ws.connection_manager.start_failed", error=str(exc))

    # Start AI model loading in background (non-blocking)
    try:
        from app.ai.model_manager import model_manager
        import asyncio
        asyncio.create_task(model_manager.load_all())
        log.info("ai.model_loading.scheduled")
    except Exception as exc:
        log.warning("ai.model_loading.failed", error=str(exc))

    yield

    await manager.stop()
    await close_redis()
    log.info("SupportIQ API shutting down")


app = FastAPI(
    title="SupportIQ API",
    description=(
        "Production-grade AI customer support infrastructure. "
        "Open-source, self-hostable, zero paid AI APIs."
    ),
    version="0.4.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Rate limiter state
# ---------------------------------------------------------------------------

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# Middleware (outermost → innermost)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        method=request.method,
        path=request.url.path,
    )
    response = await call_next(request)
    log.info("request", status_code=response.status_code)
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

register_exception_handlers(app)


@app.exception_handler(422)
async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "validation_error", "message": str(exc)}},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

API_PREFIX = "/api/v1"

app.include_router(health.router)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(conversations.router, prefix=API_PREFIX)
app.include_router(escalations.router, prefix=API_PREFIX)
app.include_router(messages.router, prefix=API_PREFIX)
app.include_router(knowledge.router, prefix=API_PREFIX)
app.include_router(feedback.router, prefix=API_PREFIX)
app.include_router(intents.router, prefix=API_PREFIX)
app.include_router(widget.router, prefix=API_PREFIX)
app.include_router(whatsapp.router, prefix=API_PREFIX)

# WebSocket — registered at /api/v1/ws (path declared inside the router)
app.include_router(ws_router.router)
