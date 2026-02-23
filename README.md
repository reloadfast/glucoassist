# GlucoSense

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
docker build -t glucosense .
docker run -d \
  --name glucosense \
  -p 3500:80 \
  -v glucosense_data:/data \
  --env-file .env \
  glucosense
```

Open `http://localhost:3500`

## Configuration

All configuration is via environment variables. See `.env.example` for the full reference.

### CGM source: nightscout-librelink-up (recommended)

Set `CGM_SOURCE=librelink` and point `LIBRELINK_URL` at your
[nightscout-librelink-up](https://github.com/timoschlueter/nightscout-librelink-up) instance.
No token is required — the librelink connector authenticates via the LibreLink credentials
stored in the nightscout-librelink-up container, not in GlucoSense.

### CGM source: Nightscout

Set `CGM_SOURCE=nightscout` and configure both variables below.

**`NIGHTSCOUT_URL`** — the base URL of your Nightscout instance, e.g.
`http://192.168.1.50:1337` or `https://mysite.herokuapp.com`.

**`NIGHTSCOUT_TOKEN`** — the raw `API_SECRET` you set when you deployed Nightscout.
GlucoSense sends it in the `API-SECRET` HTTP header when polling
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

## Development

See `CONTRIBUTING.md` (coming soon) for local dev setup.

## License

TBD — private repository for now.
