from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Qdrant (not used — using pgvector instead)
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "teedesk_knowledge"

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

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("postgresql+asyncpg://", "postgresql://")


settings = Settings()
