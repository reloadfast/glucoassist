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

## Development

See `CONTRIBUTING.md` (coming soon) for local dev setup.

## License

TBD — private repository for now.
