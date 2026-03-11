# Contributing to GlucoAssist

## Local Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for integration testing)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run dev server (auto-reload)
uvicorn app.main:app --reload --port 8000
```

Run tests:

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing
```

Run linter / formatter:

```bash
ruff check .
ruff format .
bandit -r app/
```

### Frontend

```bash
cd frontend
npm install

# Dev server with proxy to backend on :8000
npm run dev
```

Run tests:

```bash
npm run test:coverage
```

Run linter / formatter:

```bash
npm run lint
npm run format
```

Build production bundle:

```bash
npm run build
```

Analyse bundle size (generates `frontend/dist/stats.html`):

```bash
npm run analyze
```

### Full Docker build

```bash
docker build -t glucoassist-dev .
docker run --rm -p 8080:80 --env-file .env glucoassist-dev
```

---

## Branching and Commits

| Branch prefix | Purpose |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Dependency updates, CI, tooling |
| `docs/` | Documentation only |

Commit message format: [Conventional Commits](https://www.conventionalcommits.org/)

```
feat: add dark mode toggle to AppLayout
fix: correct TIR calculation for partial windows
docs: add environment variable reference to README
```

---

## Pull Request Checklist

- [ ] All backend tests pass (`pytest`)
- [ ] Backend coverage ≥ 80%
- [ ] All frontend tests pass (`npm run test:coverage`)
- [ ] Linter clean (`ruff check`, `npm run lint`)
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] Security scans pass (`bandit`, `pip-audit`, `npm audit`)
- [ ] `.env.example` updated if new env vars added

---

## Project Structure

```
backend/app/
  api/v1/        — FastAPI route handlers
  core/          — Config, logging
  db/            — Engine, session, Base
  models/        — SQLAlchemy ORM models
  schemas/       — Pydantic I/O schemas
  services/      — Business logic (ingest, forecasting, patterns, ratios)

frontend/src/
  components/    — Shared UI components + shadcn/ui
  hooks/         — Data-fetching hooks (useGlucoseData, useForecast, …)
  lib/           — Typed API client
  pages/         — Route-level page components
  test/          — Vitest + React Testing Library tests
```

---

## Adding a New API Endpoint

1. Add Pydantic schema to `backend/app/schemas/`
2. Add route handler in `backend/app/api/v1/`
3. Register the router in `backend/app/api/v1/__init__.py`
4. Add typed fetch function to `frontend/src/lib/api.ts`
5. Add hook in `frontend/src/hooks/`
6. Write tests for both backend (pytest) and frontend (Vitest)

---

## Sensitive Data

- Never commit `.env`, secrets, or tokens
- All secrets via env vars only; document in `.env.example` with placeholder values
- SQLite file is gitignored

---

## AI Assistant — Live Data Access (MCP Server)

`mcp/server.py` is a [Model Context Protocol](https://modelcontextprotocol.io) server that lets a Copilot CLI session (or any MCP-capable client) call GlucoAssist data tools directly, without copy-pasting values.

### Prerequisites

```bash
pip install mcp httpx   # mcp 1.26+ required
```

### Wire up (GitHub Copilot CLI)

Add the following entry to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "glucoassist": {
      "command": "python3",
      "args": ["/absolute/path/to/GlucoAssist/mcp/server.py"],
      "env": { "GLUCOASSIST_API_URL": "http://localhost:3500" }
    }
  }
}
```

Restart the CLI session after editing the config. The container must be running.

### Available tools

| Tool | Description |
|---|---|
| `get_status` | Latest reading, 24 h stats, IOB |
| `get_glucose_history(hours)` | Recent CGM readings (default 4 h) |
| `get_forecast` | 30/60/90/120 min predictions + action suggestions |
| `get_insulin_log(hours)` | Recent insulin doses |
| `get_meal_log(hours)` | Recent meals |
| `get_analytics` | 30/60/90 d stats, HbA1c estimate, patterns |
| `get_ratios` | ICR / CF by time-of-day slot |
| `get_dose_proposal(carbs_g)` | Meal bolus proposal |
| `log_insulin(units, type)` | Write insulin dose (confirm with user first) |
| `log_meal(carbs_g, label)` | Write meal entry (confirm with user first) |

> **Note:** `mcp-config.json` is not committed to the repository — it lives in your home directory and may contain secrets for other MCP servers.
