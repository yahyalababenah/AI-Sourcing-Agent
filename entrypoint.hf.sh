#!/bin/bash
set -e

# HuggingFace Spaces entrypoint
# DB and Redis are external services (Supabase + Upstash)
# Extract DB_HOST from DATABASE_URL if not set explicitly

if [ -n "$DATABASE_URL" ]; then
    # Extract host from: postgresql+asyncpg://user:pass@host:port/db
    PARSED_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
    PARSED_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    export DB_HOST="${DB_HOST:-$PARSED_HOST}"
    export DB_PORT="${DB_PORT:-$PARSED_PORT}"
fi

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
MAX_TRIES=30
TRIES=0
until python -c "
import socket, os, sys
host = os.getenv('DB_HOST', 'postgres')
port = int(os.getenv('DB_PORT', 5432))
try:
    socket.setdefaulttimeout(5)
    s = socket.socket()
    s.connect((host, port))
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge "$MAX_TRIES" ]; then
        echo "[entrypoint] ERROR: PostgreSQL not reachable after ${MAX_TRIES} attempts."
        exit 1
    fi
    echo "[entrypoint] Attempt ${TRIES}/${MAX_TRIES} — retrying in 2s..."
    sleep 2
done

echo "[entrypoint] PostgreSQL is ready."
echo "[entrypoint] Running migrations..."
alembic upgrade head
echo "[entrypoint] Done."

exec "$@"
