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
