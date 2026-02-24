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
- [ ] `unraid/GlucoAssist.xml` updated if ports/volumes/env vars changed

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
- SQLite file is gitignored; so is `unraid/`
