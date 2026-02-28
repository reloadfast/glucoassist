# ─── Stage 1: Build frontend ─────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ .
RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM python:3.12-slim

# System packages
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       nginx \
       supervisor \
    && rm -rf /var/lib/apt/lists/*

# Python runtime deps only (stop before the Dev/Test section)
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN awk '/Dev \/ Test/{exit} /^[A-Za-z]/{print}' requirements.txt \
    | pip install --no-cache-dir -r /dev/stdin

# Backend source
COPY backend/app/ ./app/
COPY backend/alembic/ ./alembic/
COPY backend/alembic.ini ./
COPY backend/pyproject.toml ./

# Utility scripts (e.g. garmin_login.py for one-time token seeding)
COPY scripts/ /app/scripts/

# Frontend static files
COPY --from=frontend-builder /build/dist/ /app/static/

# Nginx config (replaces default)
COPY docker/nginx.conf /etc/nginx/nginx.conf
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

# Supervisor config
COPY docker/supervisord.conf /etc/supervisor/supervisord.conf

# Entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Data directory for SQLite volume mount
RUN mkdir -p /data && chmod 700 /data

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
