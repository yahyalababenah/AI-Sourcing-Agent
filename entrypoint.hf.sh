#!/bin/bash
set -e

# HuggingFace Spaces entrypoint
# DB and Redis are external services (Supabase + Upstash)
# Extract DB_HOST from DATABASE_URL if not set explicitly

# TEMPORARY: sync fallback for demo, revert to external S3 once a real
# provider is set up. Starts MinIO as a background process inside this same
# container so live catalog uploads work without an external S3 account.
# Storage lives at /data/minio and is ephemeral — wiped on every restart/rebuild.
echo "[entrypoint] Starting MinIO (internal, ephemeral storage at /data/minio)..."
minio server /data/minio --address ":9000" --console-address ":9001" \
    > /tmp/minio.log 2>&1 &
MINIO_PID=$!

echo "[entrypoint] Waiting for MinIO to become healthy..."
MAX_TRIES=20
TRIES=0
until curl -fsS http://localhost:9000/minio/health/live >/dev/null 2>&1; do
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge "$MAX_TRIES" ]; then
        echo "[entrypoint] WARNING: MinIO not healthy after ${MAX_TRIES} attempts (pid ${MINIO_PID})."
        echo "[entrypoint] Last MinIO log lines:"
        tail -n 20 /tmp/minio.log || true
        break
    fi
    sleep 1
done
if curl -fsS http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    echo "[entrypoint] MinIO is healthy on :9000 (console :9001)."
fi

if [ -n "$DATABASE_URL" ]; then
    # Extract host from: postgresql+asyncpg://user:pass@host:port/db
    PARSED_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
    PARSED_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    export DB_HOST="${DB_HOST:-$PARSED_HOST}"
    export DB_PORT="${DB_PORT:-$PARSED_PORT}"
fi

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] Checking PostgreSQL at ${DB_HOST}:${DB_PORT}..."
MAX_TRIES=20
TRIES=0

# Supabase requires SSL — use openssl for handshake check, fallback to raw socket
until python3 -c "
import socket, ssl, os, sys
host = os.getenv('DB_HOST', 'postgres')
port = int(os.getenv('DB_PORT', 5432))
try:
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    sock = socket.create_connection((host, port), timeout=10)
    ssock = context.wrap_socket(sock, server_hostname=host)
    ssock.close()
    sys.exit(0)
except Exception:
    try:
        # Fallback: raw socket (for non-SSL Postgres like local dev)
        sock = socket.create_connection((host, port), timeout=10)
        sock.close()
        sys.exit(0)
    except Exception:
        sys.exit(1)
" 2>/dev/null; do
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge "$MAX_TRIES" ]; then
        echo "[entrypoint] WARNING: PostgreSQL not reachable after ${MAX_TRIES} attempts."
        echo "[entrypoint] Attempting migrations anyway — may fail if DB is down."
        break
    fi
    echo "[entrypoint] Attempt ${TRIES}/${MAX_TRIES} — retrying in 3s..."
    sleep 3
done

echo "[entrypoint] Running migrations..."
alembic upgrade head 2>&1 || echo "[entrypoint] WARNING: Migrations failed — will retry on startup."
echo "[entrypoint] Starting application..."

exec "$@"
