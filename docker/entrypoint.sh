#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/data/glucosense.db}"
DB_DIR="$(dirname "$DB_PATH")"

# Ensure data directory exists
mkdir -p "$DB_DIR"

# Lock down existing DB file
if [ -f "$DB_PATH" ]; then
    chmod 600 "$DB_PATH"
fi

cd /app/backend

# Run Alembic migrations if any exist
if [ -d "alembic/versions" ] && [ "$(ls -A alembic/versions 2>/dev/null)" ]; then
    echo "[entrypoint] Running database migrations..."
    alembic upgrade head
else
    echo "[entrypoint] No migrations found — skipping."
fi

echo "[entrypoint] Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
