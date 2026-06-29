#!/bin/bash
set -e

# Wait for PostgreSQL to be reachable before running migrations.
# Docker DNS and network setup can lag a few seconds after container start.
echo "[entrypoint] Waiting for PostgreSQL..."
MAX_TRIES=30
TRIES=0
until python -c "
import socket, os, sys
host = os.getenv('DB_HOST', 'postgres')
port = int(os.getenv('DB_PORT', 5432))
try:
    socket.setdefaulttimeout(2)
    socket.socket().connect((host, port))
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge "$MAX_TRIES" ]; then
        echo "[entrypoint] ERROR: PostgreSQL not reachable after ${MAX_TRIES} attempts. Exiting."
        exit 1
    fi
    echo "[entrypoint] PostgreSQL not ready (attempt ${TRIES}/${MAX_TRIES}) — retrying in 2s..."
    sleep 2
done

echo "[entrypoint] PostgreSQL is ready."
echo "[entrypoint] Running database migrations..."
alembic upgrade head
echo "[entrypoint] Migrations complete."

exec "$@"
