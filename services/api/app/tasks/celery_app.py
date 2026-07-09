"""Celery application instance."""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "supportiq",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.retrain"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        # Auto-retrain intent classifiers nightly from accumulated feedback
        "nightly-retrain": {
            "task": "app.tasks.retrain.retrain_all_tenants",
            "schedule": 86_400,  # every 24 hours
        },
    },
)
