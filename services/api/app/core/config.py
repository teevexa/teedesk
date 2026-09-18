from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Single source of truth for the app version — main.py (FastAPI docs) and
# the /health and / endpoints all read this, instead of each hardcoding
# their own (previously divergent: 0.2.0 / 0.3.0 / 0.4.0 in three places).
APP_VERSION = "0.4.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    log_level: str = "info"
    environment: str = "development"
    # Comma-separated string — parsed into a list via the `cors_origins` property below.
    # pydantic-settings JSON-parses List fields before validators run, so we keep this as str.
    allowed_origins: str = "http://localhost:5173"

    # Number of trusted reverse-proxy hops in front of this app (e.g. 1 for a
    # single Caddy/nginx in front). X-Forwarded-For is only trusted for this
    # many trailing hops — 0 (default) means it's ignored entirely, since an
    # unauthenticated client can set that header to anything.
    trusted_proxy_count: int = 0

    # Database
    database_url: str = "postgresql+asyncpg://teedesk:teedesk_dev@localhost:5432/teedesk"
    database_pool_size: int = 20
    database_max_overflow: int = 0

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth (placeholder — Phase 3)
    secret_key: str = "change-this-to-a-very-long-random-secret-key-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Ollama — local LLM inference
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral:7b-instruct"
    ollama_timeout: int = 60  # seconds per generation request

    # AI / NLP model config
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    sentiment_model: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    spacy_model: str = "en_core_web_sm"
    embedding_cache_ttl: int = 3600        # seconds in Redis
    sentiment_cache_ttl: int = 3600
    intent_min_confidence: float = 0.55    # below this → intent = "unknown"
    rag_top_k: int = 3                     # number of KB articles to retrieve
    rag_min_similarity: float = 0.6        # cosine similarity threshold

    # Feature flags
    enable_voice_escalation: bool = True
    enable_auto_escalation: bool = True
    escalation_sentiment_threshold: float = -0.6
    ai_pipeline_enabled: bool = True       # set False to fall back to canned replies

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # WhatsApp Business API (Meta Cloud API)
    whatsapp_verify_token: str = ""
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_app_secret: str = ""

    # Telegram Bot API
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""

    # SMTP (transactional email — verification, password reset)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_email: str = "noreply@teedesk.local"
    smtp_from_name: str = "TeeDesk"
    frontend_url: str = "http://localhost:5173"

    # Attachments (local disk storage)
    attachment_storage_dir: str = "./data/attachments"
    max_attachment_size_mb: int = 10

    # Knowledge base document ingestion (PDF/DOCX upload)
    max_kb_upload_size_mb: int = 20

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def secret_key_is_default(self) -> bool:
        return self.secret_key == self.model_fields["secret_key"].default

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://")


settings = Settings()
