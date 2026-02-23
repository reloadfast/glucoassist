#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/data/glucosense.db}"
DB_DIR="$(dirname "$DB_PATH")"

echo "[entrypoint] Database path : $DB_PATH"
echo "[entrypoint] Database dir  : $DB_DIR"

# Ensure data directory exists
mkdir -p "$DB_DIR"

# Verify the directory is writable before attempting migrations
if ! touch "${DB_DIR}/.write_test" 2>/dev/null; then
    echo "[entrypoint] ERROR: cannot write to ${DB_DIR}"
    echo "[entrypoint]   Check that the volume is mounted and has correct permissions."
    echo "[entrypoint]   On Unraid: verify the container's Data path mapping exists and is writable."
    exit 1
fi
rm -f "${DB_DIR}/.write_test"

# Export so child processes (alembic) see the resolved value
export DATABASE_PATH="$DB_PATH"

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
