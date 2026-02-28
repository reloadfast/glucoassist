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

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`
and fill in your values. The only required variable is `APP_SECRET_KEY`; all
others have sensible defaults.

### CGM Source

Set `CGM_SOURCE` to one of four values. Options 1 and 2 eliminate the need for
a full Nightscout + MongoDB stack.

#### Option 1 — Direct LibreView API (recommended, single container)

GlucoAssist connects directly to Abbott's LibreView API. No sidecar containers required.

```env
CGM_SOURCE=librelink_direct
LIBRELINK_EMAIL=your-librelink-email@example.com
LIBRELINK_PASSWORD=your-librelink-password
LIBRELINK_REGION=EU   # EU, US, DE, AU, CA, AP, FR, JP, AE, EU2
```

Auth tokens are cached at `LIBRELINK_TOKENSTORE` (`/data/librelink_tokens.json`
by default) and refreshed automatically when they expire.

**Backfill limitation**: LibreView's API only exposes the current sensor window
(~8 h of readings). Historical backfill is not available for this source.
Data accumulates going forward once this source is active.

#### Option 2 — nightscout-librelink-up push receiver (two containers)

Run [nightscout-librelink-up](https://github.com/timoschlueter/nightscout-librelink-up)
as a sidecar. It polls LibreView and pushes readings directly to GlucoAssist —
no Nightscout or MongoDB required.

```env
CGM_SOURCE=librelink_push
```

Use the provided `docker-compose.yml`:

```bash
cp .env.example .env   # fill in LINK_UP_USERNAME, LINK_UP_PASSWORD, APP_SECRET_KEY
docker compose up -d
```

Set `LINK_UP_ALL_DATA=true` on the first run to import the full sensor history
from the current sensor window.

#### Option 3 — Poll a nightscout-librelink-up instance

```env
CGM_SOURCE=librelink
LIBRELINK_URL=http://192.168.1.x:7800
```

No token required — LibreLink credentials are stored in the
nightscout-librelink-up container, not here.

#### Option 4 — Nightscout

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
| Heroku | App Settings → Config Vars → `API_SECRET` |
| Render / Railway | Environment tab → `API_SECRET` |

### Garmin Connect (optional)

Enables automatic daily ingest of resting heart rate, weight, sleep hours,
and stress level — used by the sleep-glucose and stress-hyperglycaemia
pattern detectors.

**Step 1 — Enable in `.env`:**

```env
GARMIN_ENABLED=true
GARMIN_USERNAME=your-email@example.com
GARMIN_PASSWORD=your-garmin-password
GARMIN_TOKENSTORE=/data/garmin_tokens
```

**Step 2 — Seed authentication tokens (required):**

GlucoAssist caches Garmin OAuth tokens to avoid hitting the Garmin SSO on
every poll, and to support accounts with MFA/2FA enabled. Run the one-time
login script after the container is up:

```bash
docker exec -it glucoassist python /app/scripts/garmin_login.py
```

If your account has MFA enabled, you will be prompted to enter a code from
your authenticator app.

> **Google / Apple sign-in accounts:** If your Garmin Connect account was
> created via Google or Apple, you must first set a native Garmin password
> before this script will work. Go to `connect.garmin.com` → *Sign In* →
> *Forgot Password?*, enter your email, and follow the reset link to set a
> password. Then update `GARMIN_PASSWORD` and re-run the script. Tokens are written to `GARMIN_TOKENSTORE`
(`/data/garmin_tokens` by default), which is on the same persistent volume
as the database and survives container restarts and upgrades.

Once tokens are saved, the ingest job runs automatically every hour. No
further action is needed unless you change your Garmin password, in which
case re-run the script to refresh the tokens.

Garmin credentials are stored only in your local environment / Docker secrets
and are never transmitted anywhere other than the official Garmin Connect API.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `CGM_SOURCE` | no | `librelink_direct` | `librelink_direct`, `librelink_push`, `librelink`, or `nightscout` |
| **Direct LibreView (Option 1)** | | | |
| `LIBRELINK_EMAIL` | if librelink_direct | — | LibreView account email |
| `LIBRELINK_PASSWORD` | if librelink_direct | — | LibreView account password |
| `LIBRELINK_REGION` | no | `EU` | LibreView region: `EU`, `US`, `DE`, `AU`, `CA`, `AP`, `FR`, `JP`, `AE`, `EU2` |
| `LIBRELINK_TOKENSTORE` | no | `/data/librelink_tokens.json` | Cached auth token file (must be on a persistent volume) |
| **nightscout-librelink-up sidecar (Option 2)** | | | |
| `LINK_UP_USERNAME` | if librelink_push | — | LibreView account email (set in sidecar) |
| `LINK_UP_PASSWORD` | if librelink_push | — | LibreView account password (set in sidecar) |
| `LINK_UP_REGION` | no | `EU` | LibreView region (set in sidecar) |
| `LINK_UP_INTERVAL` | no | `5` | Poll interval in minutes (set in sidecar) |
| `LINK_UP_ALL_DATA` | no | `false` | Import full sensor history on first run (set in sidecar) |
| **Poll nightscout-librelink-up (Option 3)** | | | |
| `LIBRELINK_URL` | if librelink | — | Base URL of nightscout-librelink-up |
| `LIBRELINK_POLL_INTERVAL` | no | `300` | Ingest interval in seconds |
| **Nightscout (Option 4)** | | | |
| `NIGHTSCOUT_URL` | if nightscout | — | Nightscout base URL |
| `NIGHTSCOUT_TOKEN` | no | — | Nightscout `API_SECRET` |
| **App** | | | |
| `APP_SECRET_KEY` | **yes** | — | Long random string for session security |
| `APP_ENV` | no | `production` | `production` or `development` — see [APP_ENV behaviour](#app_env-behaviour) |
| `DATABASE_PATH` | no | `/data/glucoassist.db` | SQLite file path inside container |
| `INGEST_INTERVAL_SECONDS` | no | `300` | Ingest scheduler interval |
| `BACKFILL_DAYS` | no | `90` | Days of CGM history to import on first startup (0 = disabled, not supported for `librelink_direct` or `librelink_push`) |
| **Garmin** | | | |
| `GARMIN_ENABLED` | no | `false` | Enable Garmin Connect integration |
| `GARMIN_USERNAME` | if garmin | — | Garmin Connect account email |
| `GARMIN_PASSWORD` | if garmin | — | Garmin Connect account password |
| `GARMIN_TOKENSTORE` | no | `/data/garmin_tokens` | Directory for cached OAuth tokens (must be on a persistent volume) |
| `GARMIN_INGEST_INTERVAL_SECONDS` | no | `3600` | Garmin poll interval (minimum 3600) |

Generate a secure `APP_SECRET_KEY`:
```bash
openssl rand -hex 32
# or
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### APP_ENV behaviour

`APP_ENV` accepts two values and affects three areas:

| Area | `production` | `development` |
|---|---|---|
| **Log level** | INFO — structured output, no debug noise | DEBUG — verbose logs including SQL queries and scheduler ticks |
| **CORS** | Same-origin only (safe behind Nginx reverse proxy) | All origins allowed (`*`) — needed when the Vite dev server runs on a different port |
| **`/api/health` response** | Returns `"environment": "production"` | Returns `"environment": "development"` |

**When to use each value:**

- `production` — the correct value for all Docker deployments (Unraid, Compose, bare container). Nginx handles routing so CORS restrictions are irrelevant and debug logging would be noisy.
- `development` — use only when running `uvicorn` directly outside Docker (e.g., `cd backend && uvicorn app.main:app --reload`) and accessing the API from a browser or frontend dev server on a different port.

> **Note:** The Unraid Community Applications template ships with `APP_ENV=development` to simplify first-run debugging. Change it to `production` once you have confirmed the stack is working.

---

## API Documentation

Interactive API docs are available at `http://localhost:3500/api/docs` (Swagger UI)
and `http://localhost:3500/api/redoc` (ReDoc) when the container is running.

---

## Further Documentation

- [Forecast Model](docs/forecast-model.md) — how the 30/60/120-minute glucose prediction works, what data it needs, accuracy, and limitations
- [CGM Sources](docs/cgm-sources.md) — detailed setup guides for all four data source modes, including docker-compose examples

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
