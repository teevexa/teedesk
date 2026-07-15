#!/usr/bin/env bash
# TeeDesk — Development Environment Setup
# Run once after cloning: bash scripts/setup.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

info "Setting up TeeDesk development environment..."

# --- Check prerequisites ---
command -v node >/dev/null 2>&1 || error "Node.js >= 18 required. Visit https://nodejs.org"
command -v npm >/dev/null 2>&1 || error "npm required"
command -v docker >/dev/null 2>&1 || warn "Docker not found. Run 'bash scripts/dev.sh infra' to start infrastructure."
command -v python3 >/dev/null 2>&1 || warn "Python 3 not found. Needed for the API service."

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ required. Current: $(node --version)"
fi

info "Node.js $(node --version) — OK"

# --- Install root dependencies (Turborepo etc.) ---
info "Installing root dependencies..."
npm install

# --- Copy env files ---
info "Setting up environment files..."

if [ ! -f apps/web/.env.local ]; then
  cp apps/web/.env.example apps/web/.env.local
  info "Created apps/web/.env.local"
else
  warn "apps/web/.env.local already exists — skipping"
fi

if [ ! -f services/api/.env ]; then
  cp services/api/.env.example services/api/.env
  info "Created services/api/.env"
else
  warn "services/api/.env already exists — skipping"
fi

if [ ! -f infrastructure/docker/.env ]; then
  cp infrastructure/docker/.env.example infrastructure/docker/.env
  info "Created infrastructure/docker/.env"
else
  warn "infrastructure/docker/.env already exists — skipping"
fi

# --- Python venv for API ---
if command -v python3 >/dev/null 2>&1; then
  if [ ! -d services/api/.venv ]; then
    info "Creating Python virtual environment for API..."
    python3 -m venv services/api/.venv
    source services/api/.venv/bin/activate
    pip install -r services/api/requirements.txt
    info "Python environment ready"
  else
    warn "services/api/.venv already exists — skipping"
  fi
fi

echo ""
info "Setup complete!"
echo ""
echo "  Start infrastructure:  bash scripts/dev.sh infra"
echo "  Start web app:         bash scripts/dev.sh web"
echo "  Start everything:      npm run dev"
echo ""
