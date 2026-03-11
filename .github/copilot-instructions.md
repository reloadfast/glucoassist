# GlucoAssist — Copilot Instructions

## Autonomy Rules
Proceed without asking for confirmation on all routine operations. Only stop for:
- Irreversible data loss (dropping DB tables, `rm -rf`, overwriting uncommitted work)
- Pushing to remote / opening PRs
- Breaking public API contracts that affect other issues/phases
- Adding new external services or third-party dependencies not already in `requirements.txt` / `package.json`

Proceed freely without prompting for:
- Reading, creating, editing, or deleting files anywhere in this repo
- Running tests, linters, formatters, security scans
- Creating git commits (but not pushing)
- Installing packages into the local venv / node_modules
- Creating branches
- Any action that is fully reversible with `git checkout` or `git reset`

## Token Efficiency Rules
- Be concise. No preamble, no summaries unless asked.
- Reference file:line instead of reproducing code blocks.
- Use bullet lists, not prose paragraphs.
- Skip "I will now..." or "Here is the..." phrases.
- When editing, show only changed lines with minimal context.
- Batch related file reads; avoid re-reading already-known files.

## Project Overview
- **GlucoAssist** — personal diabetes predictive intelligence system for a single user
- CGM data source: local nightscout-librelink-up instance (primary), Nightscout (fallback)
- Local-first, privacy-first: no cloud dependency; fully self-hosted via Docker
- Decision-support only — no autonomous dosing or medical advice
- Deployed as a single Docker container on Unraid (Community Applications)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| Charts | Recharts (primary), Tremor (dashboards) |
| Backend | Python 3.12 + FastAPI |
| ORM / Migrations | SQLAlchemy 2 + Alembic |
| Database | SQLite (local-first; TimescaleDB considered for future scale) |
| Task Queue | APScheduler (ingest jobs) |
| Container | Single Docker container (Nginx + Uvicorn via Supervisor) |
| Testing (BE) | pytest + pytest-asyncio + httpx |
| Testing (FE) | Vitest + React Testing Library |
| Security Scan | Bandit (Python), pip-audit, npm audit |
| Linting | Ruff (Python), ESLint + Prettier (JS/TS) |
| CI | GitHub Actions |

## Architecture

```
nginx (port 80 inside container)
  ├─ /api/*  → proxy → uvicorn (FastAPI) :8000
  └─ /*      → static files (built React app)

Supervisor manages: nginx + uvicorn
SQLite file mounted via Docker volume
```

## Project Structure

```
GlucoAssist/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── core/         # Config, security, logging
│   │   ├── db/           # Engine, session, base
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic, ingest, ML
│   │   └── main.py
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   ├── nginx.conf
│   ├── supervisord.conf
│   └── entrypoint.sh
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── security.yml
├── Dockerfile
├── .env.example          # Template — never .env
├── .gitignore
└── README.md
```

## Sensitive Data Rules
- NEVER commit `.env`, secrets, tokens, API keys, or passwords
- All secrets via environment variables; document in `.env.example` with placeholder values only
- nightscout-librelink-up URL/token = env vars only
- Nightscout URL/token = env vars only
- SQLite DB file is gitignored

## Environment Variables

```
# Data source (use one)
LIBRELINK_URL=               # nightscout-librelink-up base URL
LIBRELINK_POLL_INTERVAL=300  # seconds

NIGHTSCOUT_URL=              # fallback Nightscout instance
NIGHTSCOUT_TOKEN=            # API secret

# App
APP_SECRET_KEY=              # FastAPI session secret
APP_VERSION=dev              # injected at docker build time; never hardcode
DATABASE_PATH=/data/glucoassist.db

# Ingest
INGEST_INTERVAL_SECONDS=300
```

## Unraid Template
The Unraid Community Applications template lives at `unraid/GlucoAssist.xml` (gitignored — internal use and local testing only).
- **Never reference this file in public-facing documentation** (README, CONTRIBUTING, or any user-visible content)
- Update the template as part of acceptance criteria whenever any of the following change: ports, env vars, volume mounts, container name
- All env vars in the template must stay in sync with `.env.example`
- After structural changes, test by importing the template into Unraid CA

## Testing Requirements
- Backend: ≥80% line coverage; tests in `backend/tests/`; pytest markers: `unit`, `integration`
- Frontend: key components and hooks covered; Vitest coverage report
- All tests must pass before merge to main
- Run security scans on every PR (Bandit, pip-audit, npm audit)
- No `# noqa` or `// eslint-disable` without an inline justification comment

## Security
- Bandit: fail on HIGH severity findings
- pip-audit: fail on known CVEs in dependencies
- npm audit: fail on critical/high
- No hardcoded credentials anywhere in the codebase
- SQLite file permissions: 600 inside container
- Nginx: no server tokens, security headers (CSP, HSTS, X-Frame-Options)

## Version Visibility
The application version must always be readable in the UI. It must **never be hardcoded** — not in source files, not in Dockerfiles, not in CI workflows.

### Source of truth — build-time injection via env var

The version is baked into the image at Docker build time from the git SHA and exposed via an environment variable. The application reads it at runtime in this priority order:

1. `APP_VERSION` environment variable (set by `docker build --build-arg APP_VERSION=sha-${{ github.sha }}`)
2. `pyproject.toml` `[project].version` — fallback for local dev
3. Hardcoded string `"dev"` — last resort only, never in production images

**Dockerfile pattern:**
```dockerfile
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
```

**CI workflow pattern (docker.yml):**
```yaml
- name: Set short SHA
  id: sha
  run: echo "short=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

- name: Build and push
  uses: docker/build-push-action@...
  with:
    build-args: APP_VERSION=${{ steps.sha.outputs.short }}
```

> ⚠️ Never pass `${{ github.sha }}` directly — the full 40-char SHA overflows UI elements. Always truncate to 7 chars via the step above.

**Backend pattern (Python):**
```python
def _read_version() -> str:
    env_ver = os.getenv("APP_VERSION", "").strip()
    if env_ver and env_ver != "dev":
        return env_ver
    try:
        # read from pyproject.toml [project].version
        ...
    except Exception:
        return "dev"
```

**Frontend pattern:** fetch version from the `/api/health` endpoint that returns `{ version: string }`. Never import it from `package.json` at runtime — that value is stale once the image is built.

### Placement (priority order)
1. Global nav/footer — preferred; visible on every screen without navigation
2. Settings / About page — acceptable when a persistent footer is not feasible; reachable in ≤ 2 clicks
3. Login / splash screen — supplement only; never the sole location

### Typography & colour
- Style: `text-muted-foreground`
- Size: `text-xs` (0.75 rem) — one step below body copy
- Do not use brand accent colours — unobtrusive but always present
- Format: `v` prefix + version string (e.g., `vdev` locally, `vabc1234` in built images — 7-char short SHA, no `sha-` prefix)

### Acceptance criteria — every PR must satisfy all of the following
- [ ] No version string is hardcoded anywhere in source, Dockerfile, or workflow files
- [ ] `APP_VERSION` is set via a `Set short SHA` step and passed as `${{ steps.sha.outputs.short }}` in every `docker build` step in CI — never the full `github.sha`
- [ ] The backend reads `APP_VERSION` env var first; falls back to `pyproject.toml`, then `"dev"`
- [ ] The UI fetches version from `/api/health` (never from a bundled manifest at runtime)
- [ ] Version renders correctly in the UI at the designated placement

## Git Conventions
- Branch prefixes: `feature/`, `fix/`, `chore/`, `docs/`
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`)
- PRs require CI green before merge
- main branch = deployable state at all times
- When creating GitHub issues, always add them to the GlucoAssist Roadmap project (`--add-project "GlucoAssist Roadmap"`)
- When merging a PR, close all issues it resolves (`gh issue close <n> --comment "Implemented in #<PR>."`)
- If issues were auto-closed by the PR merge, verify and skip redundant close commands

## Parallel Agents
Multiple Copilot agents may work on this repo simultaneously on separate branches. To avoid cross-contamination:
- Before fixing any CI failure, run `git diff main...HEAD -- <file>` to confirm the offending code is within your branch's diff
- If the failure is in a file you did not touch (introduced by another agent on main), do NOT fix it in the current branch — create a separate `fix/` branch targeting main and open its own PR
- Each branch/PR must own only the changes scoped to its issue; never absorb unrelated fixes to make CI green

## Domain Knowledge

### Key Formulas
- **HbA1c estimate:** `(eAG + 46.7) / 28.7` where eAG = average glucose in mg/dL
- **Rolling windows:** 30d, 60d, 90d for all trend and projection calculations

### CGM Data Schema
Core fields:
```
timestamp (UTC), glucose_mg_dl, trend_arrow, source, device_id
```
Extended fields: `insulin_units`, `carbs_g`, `meal_label`, `heart_rate_bpm`, `weight_kg`, `activity_type`, `activity_minutes`, `notes`

### Design Language

**Color system**
- No pure black or pure white — dark backgrounds use deep slate-blue tones; light backgrounds use warm off-white
- Semantic tokens only — all colors via CSS custom properties in `index.css`; never hardcode Tailwind color literals where a semantic token exists
- Accent: emerald (`--primary` / `--accent`) for positive metrics and interactive elements
- Warning: amber for partial/moderate states; orange for high; red/pink for missing/critical
- Dark mode: any component using hardcoded Tailwind background or border utilities (e.g. `bg-amber-50`, `border-red-200`) **must** include `dark:` variants

**Border radius**
- `--radius: 0.75rem` → `rounded-lg` = 0.75rem, `rounded-xl` = 1rem
- Prefer `rounded-lg` (Card default) or `rounded-xl` for elevated surfaces; never `rounded-none` unless intentional

**Shadows & elevation**
- Soft shadows only (`shadow-sm`, `shadow-md`); no harsh `shadow-xl` or `drop-shadow-*` on interior cards
- In dark mode, use subtle border (`/30` alpha) for surface separation rather than shadow

**Typography**
- Large bold numerics as headline metrics: `text-3xl font-bold`
- Small labels: `text-xs font-medium uppercase tracking-wide text-muted-foreground`

**Animations**
- Transitions: `transition-colors duration-150 ease-out`; keep motion 150–250 ms

**What NOT to do**
- No bright saturated colors inside card bodies
- No gradients inside components (subtle `bg-gradient-to-b` on page background only is acceptable)
- No skeuomorphic shadows or borders

### Contextual Documentation Requirements

Every feature that introduces a new metric, calculation, clinical concept, or non-obvious term **must** include in-app help as a blocking acceptance criterion.

**Three-tier help model:**

| Tier | Component | When to use | Max length |
|---|---|---|---|
| Hover | `Tooltip` (`components/ui/tooltip.tsx`) | ≤ 15-word definition, no formula | 1 line |
| Click | `HelpPopover` (`components/HelpPopover.tsx`) | 1–3 paragraphs, optional formula/table | ~120 words |
| Click | `HelpSheet` (`components/HelpSheet.tsx`) | Multi-section, clinical context, methodology | Unlimited |

**Acceptance criteria rule:** Any PR adding a new data point, metric, chart element, or analytical result visible to the user must include at minimum one HelpPopover or HelpSheet entry. PRs without this are incomplete regardless of test coverage.

**Writing guidelines:**
- Plain language first; assume no prior diabetes or statistics knowledge
- Formula/statistical detail in a secondary section, never the lead
- End any section involving clinical values with: _"Decision-support only — always follow guidance from your healthcare team."_
- Use tables for reference ranges, not prose lists
- Keep popovers under 120 words; move anything longer to a HelpSheet

## Development Phases
1. **Foundation** — scaffold, Docker, CI, data ingest skeleton
2. **Data Layer** — DB schema, ingest pipeline, REST API, raw data views
3. **Analytics** — HbA1c projection, trend analysis, pattern detection
4. **Forecasting** — 30/60/120-min glucose prediction, risk estimation
5. **Intelligence** — ML training pipeline, ratio optimisation, pattern discovery
6. **Polish** — UX refinement, performance, documentation
