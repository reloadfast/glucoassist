# GlucoAssist

Personal diabetes predictive intelligence system. A local-first, privacy-respecting analytics platform that learns from your CGM data to provide glucose forecasting, pattern detection, and metabolic insight for Type 1 diabetes management.

> **This is a personal analytics tool — not a medical device. Not a replacement for medical advice. No autonomous insulin dosing.**

---

## Features

- **Real-time glucose display** — current reading, trend arrow, and delta from last reading
- **Time-in-range analytics** — tight (70–140), standard (70–180), and hypo/hyper bands across 24h / 7d / 30d windows
- **HbA1c projection** — estimated from 30/60/90-day rolling CGM averages
- **Glucose forecasting** — 30, 60, and 120-minute predictions with uncertainty bounds
- **Hypo/hyper risk estimation** — probability and confidence for each horizon
- **Pattern detection** — nine evidence-based patterns including:
  - Dawn phenomenon
  - Post-meal spikes
  - Exercise-induced hypo / rebound
  - Nocturnal hypoglycaemia
  - Meal-timing consistency
  - Basal drift
  - Sleep-glucose correlation (requires Garmin)
  - Stress-hyperglycaemia correlation (requires Garmin)
- **Insulin-to-carb and correction factor analysis** — 30/60/90-day rolling estimates per time block
- **Garmin Connect integration** — optional daily ingest of resting HR, weight, sleep hours, and stress level for richer pattern analysis

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Python 3.12 + FastAPI |
| Database | SQLite (local-first) |
| Task queue | APScheduler |
| Container | Single Docker container (Nginx + Uvicorn + Supervisor) |

---

## Quick Start

### Docker (recommended)

```bash
# 1. Copy the environment template
cp .env.example .env

# 2. Edit .env — set CGM_SOURCE, your CGM URL/token, and APP_SECRET_KEY
#    See "Configuration" below for details

# 3. Pull and run (replace 3500 with your preferred host port)
docker run -d \
  --name glucoassist \
  --restart unless-stopped \
  -p 3500:80 \
  -v glucoassist_data:/data \
  --env-file .env \
  talesofthemoon/glucoassist:latest
```

Open `http://localhost:3500`

### Docker Compose

```yaml
services:
  glucoassist:
    image: talesofthemoon/glucoassist:latest
    container_name: glucoassist
    restart: unless-stopped
    ports:
      - "3500:80"
    volumes:
      - glucoassist_data:/data
    env_file: .env

volumes:
  glucoassist_data:
```

```bash
docker compose up -d
```

### Unraid Community Applications

Import the template from `unraid/GlucoAssist.xml`, or place the XML in
`/boot/config/plugins/community.applications/AppsData/` and restart the
Community Applications plugin.

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`
and fill in your values. The only required variable is `APP_SECRET_KEY`; all
others have sensible defaults.

### CGM Source

Set `CGM_SOURCE` to either `librelink` or `nightscout`.

#### nightscout-librelink-up (recommended)

Run a local [nightscout-librelink-up](https://github.com/timoschlueter/nightscout-librelink-up)
container, then point GlucoAssist at it:

```env
CGM_SOURCE=librelink
LIBRELINK_URL=http://192.168.1.x:7800
```

No token required — LibreLink credentials are stored in the
nightscout-librelink-up container, not here.

#### Nightscout

```env
CGM_SOURCE=nightscout
NIGHTSCOUT_URL=http://192.168.1.x:1337
NIGHTSCOUT_TOKEN=your-api-secret
```

`NIGHTSCOUT_TOKEN` is the raw `API_SECRET` you set when you deployed Nightscout
(minimum 12 characters). GlucoAssist sends it in the `API-SECRET` HTTP header.

| Deployment | Where to find `API_SECRET` |
|---|---|
| Docker / Compose | `API_SECRET` in your `docker-compose.yml` or `docker inspect nightscout \| grep API_SECRET` |
| Unraid | Nightscout container → Edit → Variables → `API_SECRET` |
| Heroku | App Settings → Config Vars → `API_SECRET` |
| Render / Railway | Environment tab → `API_SECRET` |

### Garmin Connect (optional)

Enables automatic daily ingest of resting heart rate, weight, sleep hours,
and stress level — used by the sleep-glucose and stress-hyperglycaemia
pattern detectors.

```env
GARMIN_ENABLED=true
GARMIN_USERNAME=your-email@example.com
GARMIN_PASSWORD=your-garmin-password
```

Garmin credentials are stored only in your local environment / Docker secrets.
They are never transmitted anywhere other than the official Garmin Connect API.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `CGM_SOURCE` | no | `nightscout` | `librelink` or `nightscout` |
| `LIBRELINK_URL` | if librelink | — | Base URL of nightscout-librelink-up |
| `LIBRELINK_POLL_INTERVAL` | no | `300` | Ingest interval in seconds |
| `NIGHTSCOUT_URL` | if nightscout | — | Nightscout base URL |
| `NIGHTSCOUT_TOKEN` | no | — | Nightscout `API_SECRET` |
| `APP_SECRET_KEY` | **yes** | — | Long random string for session security |
| `APP_ENV` | no | `production` | `production` or `development` |
| `DATABASE_PATH` | no | `/data/glucoassist.db` | SQLite file path inside container |
| `INGEST_INTERVAL_SECONDS` | no | `300` | Ingest scheduler interval |
| `BACKFILL_DAYS` | no | `90` | Days of CGM history to import on first startup (0 = disabled) |
| `GARMIN_ENABLED` | no | `false` | Enable Garmin Connect integration |
| `GARMIN_USERNAME` | if garmin | — | Garmin Connect account email |
| `GARMIN_PASSWORD` | if garmin | — | Garmin Connect account password |
| `GARMIN_INGEST_INTERVAL_SECONDS` | no | `3600` | Garmin poll interval (minimum 3600) |

Generate a secure `APP_SECRET_KEY`:
```bash
openssl rand -hex 32
# or
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## API Documentation

Interactive API docs are available at `http://localhost:3500/api/docs` (Swagger UI)
and `http://localhost:3500/api/redoc` (ReDoc) when the container is running.

---

## Data & Privacy

- All data is stored in a single SQLite file at `DATABASE_PATH`
- No data leaves your host — no telemetry, no cloud sync
- Mount a persistent Docker volume to preserve data across container restarts
- Garmin credentials are only used to call the official Garmin Connect API

---

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for local dev setup, branching conventions, and PR guidelines.

---

## License

[MIT](LICENSE)
