#!/usr/bin/env bash
# TeeDesk — Development utilities
# Usage: bash scripts/dev.sh [command]
#
# Commands:
#   infra    Start Docker infrastructure (Postgres, Redis, Ollama)
#   web      Start web frontend dev server
#   api      Start FastAPI backend dev server
#   pull     Pull recommended Ollama models
#   reset    Reset Docker volumes (WARNING: deletes data)

set -euo pipefail

COMMAND="${1:-help}"

case "$COMMAND" in
  infra)
    echo "[dev] Starting infrastructure..."
    cd infrastructure/docker
    docker compose up -d postgres redis ollama
    echo "[dev] Infrastructure started:"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis:      localhost:6379"
    echo "  Ollama:     localhost:11434"
    ;;

  web)
    echo "[dev] Starting web app..."
    cd apps/web
    npm run dev
    ;;

  api)
    echo "[dev] Starting API service..."
    # Stop the Docker API container if running — it would shadow the local server on port 8000
    docker stop teedesk-api 2>/dev/null && docker rm teedesk-api 2>/dev/null || true
    cd services/api
    ../../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
    ;;

  pull)
    echo "[dev] Pulling Ollama models..."
    # Embeddings/sentiment/NER run in-process via sentence-transformers/spaCy
    # (see services/api/app/ai/model_manager.py) — Ollama only serves the LLM.
    docker exec teedesk-ollama ollama pull mistral:7b-instruct
    echo "[dev] Models ready"
    ;;

  reset)
    echo "[dev] WARNING: This will delete all Docker volumes (database data)."
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      cd infrastructure/docker
      docker compose down -v
      echo "[dev] Volumes reset."
    else
      echo "[dev] Cancelled."
    fi
    ;;

  *)
    echo "Usage: bash scripts/dev.sh [infra|web|api|pull|reset]"
    ;;
esac
