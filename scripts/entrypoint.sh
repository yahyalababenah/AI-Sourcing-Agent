#!/bin/bash
# ===================================================================
# AI-Sourcing Hub — Docker Entrypoint
# ===================================================================
# Runs database migrations, then starts the application server.
# Called by both docker-compose (api service) and production.
#
# Environment variables:
#   UVICORN_WORKERS   — Number of uvicorn workers (default: 4)
#   UVICORN_PORT      — Port to bind (default: 8000)
#   UVICORN_LOG_LEVEL — Log level (default: info)
# ===================================================================

set -e

# ── Configuration ────────────────────────────────────────────────────
WORKERS="${UVICORN_WORKERS:-4}"
PORT="${UVICORN_PORT:-8000}"
LOG_LEVEL="${UVICORN_LOG_LEVEL:-info}"

# ── Database Migration ────────────────────────────────────────────────
echo "=== Running database migrations ==="
alembic upgrade head
echo "=== Migrations complete ==="

# ── Start Application Server ─────────────────────────────────────────
echo "=== Starting uvicorn with ${WORKERS} workers on port ${PORT} ==="
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers "${WORKERS}" \
    --log-level "${LOG_LEVEL}" \
    --proxy-headers \
    --forwarded-allow-ips '*'
