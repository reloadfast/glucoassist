# GlucoAssist

Personal diabetes predictive intelligence system. A local-first, privacy-respecting analytics platform that learns from CGM data to provide glucose forecasting, pattern detection, and metabolic insight for Type 1 diabetes management.

> **This is a personal analytics tool — not a medical device. Not a replacement for medical advice. No autonomous insulin dosing.**

## What It Does

- Ingests real-time CGM data from a local [nightscout-librelink-up](https://github.com/timoschlueter/nightscout-librelink-up) or Nightscout instance
- Forecasts glucose 30, 60, and 120 minutes ahead
- Estimates hypo/hyper risk with uncertainty bounds
- Detects patterns (dawn phenomenon, exercise sensitivity, basal drift)
- Projects HbA1c trends from 30/60/90-day CGM averages
- Analyses insulin-to-carb ratios and correction factors over time

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Python 3.12 + FastAPI |
| Database | SQLite (local-first) |
| Container | Single Docker container |

## Quick Start

```bash
cp .env.example .env
# Edit .env with your local nightscout-librelink-up or Nightscout URL
docker build -t glucoassist .
docker run -d \
  --name glucoassist \
  -p 3500:80 \
  -v glucoassist_data:/data \
  --env-file .env \
  glucoassist
```

Open `http://localhost:3500`

## Configuration

All configuration is via environment variables. See `.env.example` for the full reference.

### CGM source: nightscout-librelink-up (recommended)

Set `CGM_SOURCE=librelink` and point `LIBRELINK_URL` at your
[nightscout-librelink-up](https://github.com/timoschlueter/nightscout-librelink-up) instance.
No token is required — the librelink connector authenticates via the LibreLink credentials
stored in the nightscout-librelink-up container, not in GlucoAssist.

### CGM source: Nightscout

Set `CGM_SOURCE=nightscout` and configure both variables below.

**`NIGHTSCOUT_URL`** — the base URL of your Nightscout instance, e.g.
`http://192.168.1.50:1337` or `https://mysite.herokuapp.com`.

**`NIGHTSCOUT_TOKEN`** — the raw `API_SECRET` you set when you deployed Nightscout.
GlucoAssist sends it in the `API-SECRET` HTTP header when polling
`/api/v1/entries.json`.

How to find your `API_SECRET`:

| Deployment | Where to look |
|---|---|
| Docker / Compose | `API_SECRET` in your `docker-compose.yml` or `docker inspect nightscout \| grep API_SECRET` |
| Unraid | Nightscout container → Edit → Variables → `API_SECRET` |
| Heroku | App Settings → Config Vars → `API_SECRET` |
| Render / Railway | Environment tab → `API_SECRET` |

Requirements: the secret must be **at least 12 characters**. Leave `NIGHTSCOUT_TOKEN`
blank only if your Nightscout instance runs without authentication (not recommended).

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `CGM_SOURCE` | no | `nightscout` | `librelink` or `nightscout` |
| `LIBRELINK_URL` | if librelink | — | Base URL of nightscout-librelink-up |
| `LIBRELINK_POLL_INTERVAL` | no | `300` | Ingest interval (seconds) |
| `NIGHTSCOUT_URL` | if nightscout | — | Nightscout base URL |
| `NIGHTSCOUT_TOKEN` | no | — | Nightscout `API_SECRET` |
| `INGEST_INTERVAL_SECONDS` | no | `300` | Scheduler interval (seconds) |
| `DATABASE_PATH` | no | `/data/glucoassist.db` | SQLite file path inside container |
| `APP_SECRET_KEY` | yes | — | Random secret for FastAPI sessions |
| `RETRAIN_INTERVAL_HOURS` | no | `24` | Forecast model retrain frequency |

See `.env.example` for a ready-to-fill template.

## Unraid

Import `unraid/GlucoAssist.xml` via Community Applications → Install from template URL, or place the XML in `/boot/config/plugins/community.applications/AppsData/` manually.

## Data

All data is stored in a single SQLite file at `DATABASE_PATH`. Mount a persistent Docker volume to preserve data across container restarts. No data leaves your host.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for local dev setup, branching conventions, and PR guidelines.

## License

[MIT](LICENSE)
