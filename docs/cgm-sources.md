# CGM Sources

GlucoAssist supports four `CGM_SOURCE` modes. Choose the one that matches your setup.

## Comparison

| Mode | Where data comes from | Historical backfill | Extra containers needed |
|---|---|---|---|
| `librelink_direct` | Abbott LibreView API (polled directly) | ✗ (current sensor window only, ~8 h) | None |
| `librelink_push` | nightscout-librelink-up → push to GlucoAssist | ✓ (set `LINK_UP_ALL_DATA=true` on first run) | uploader container |
| `librelink` | nightscout-librelink-up (polled) | ✓ | uploader container |
| `nightscout` | Nightscout instance (polled) | ✓ | Nightscout |

---

## Option 1 — Direct LibreView API (`librelink_direct`)

**Recommended for most users.** GlucoAssist connects directly to Abbott's LibreView API using your FreeStyle LibreLink account credentials. No sidecar containers required.

```env
CGM_SOURCE=librelink_direct
LIBRELINK_EMAIL=your@email.com
LIBRELINK_PASSWORD=your-password
LIBRELINK_REGION=EU   # EU, US, DE, AU, CA, AP, FR, JP, AE, EU2
```

Auth tokens are cached at `LIBRELINK_TOKENSTORE` (`/data/librelink_tokens.json` by default) and refreshed automatically.

**Limitation:** LibreView only exposes the current sensor window (~8 hours of readings). Historical data is not available. Data accumulates going forward once GlucoAssist is running.

---

## Option 2 — nightscout-librelink-up push receiver (`librelink_push`)

[nightscout-librelink-up](https://github.com/timoschlueter/nightscout-librelink-up) polls LibreView and pushes readings to GlucoAssist over the Nightscout entries API. This mode eliminates Nightscout and MongoDB entirely.

### Architecture

```
nightscout-librelink-up
    ↓  POST /api/v1/entries  (every LINK_UP_INTERVAL minutes)
GlucoAssist
    ↓  stores readings
SQLite
```

### Setup

**Step 1 — Set `CGM_SOURCE` in `.env`:**

```env
CGM_SOURCE=librelink_push

# LibreView credentials for the sidecar uploader
LINK_UP_USERNAME=your@email.com
LINK_UP_PASSWORD=your-password
LINK_UP_REGION=EU
LINK_UP_INTERVAL=5          # poll interval in minutes
LINK_UP_ALL_DATA=true       # set true on FIRST run only to import full sensor history
```

> Set `LINK_UP_ALL_DATA=false` (or remove it) after the first run. Leaving it as `true` re-imports the full sensor window on every restart.

**Step 2 — Start both containers with the provided `docker-compose.yml`:**

```bash
cp .env.example .env
# fill in LINK_UP_USERNAME, LINK_UP_PASSWORD, APP_SECRET_KEY
docker compose up -d
```

The provided `docker-compose.yml` wires both containers on the same Docker network and sets `NIGHTSCOUT_URL=http://glucoassist` so the uploader points at GlucoAssist instead of a real Nightscout instance.

### docker-compose.yml (annotated)

```yaml
services:
  glucoassist:
    image: talesofthemoon/glucoassist:latest
    container_name: glucoassist
    restart: unless-stopped
    ports:
      - "${HOST_PORT:-3500}:80"
    volumes:
      - glucoassist_data:/data
    env_file: .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  librelink-up:
    image: ghcr.io/timoschlueter/nightscout-librelink-up:latest
    container_name: librelink-up
    restart: unless-stopped
    depends_on:
      glucoassist:
        condition: service_healthy
    environment:
      LINK_UP_USERNAME: ${LINK_UP_USERNAME}
      LINK_UP_PASSWORD: ${LINK_UP_PASSWORD}
      LINK_UP_REGION: ${LINK_UP_REGION:-EU}
      LINK_UP_INTERVAL: ${LINK_UP_INTERVAL:-5}
      LINK_UP_ALL_DATA: ${LINK_UP_ALL_DATA:-false}
      # Point the uploader at GlucoAssist, not a real Nightscout instance
      NIGHTSCOUT_URL: http://glucoassist
      # GlucoAssist accepts unauthenticated pushes from co-located containers.
      # Any non-empty string works here. See note below.
      API_SECRET: "placeholder"

volumes:
  glucoassist_data:
```

### Environment variable mapping

| nightscout-librelink-up var | GlucoAssist var | Notes |
|---|---|---|
| `LINK_UP_USERNAME` | — | LibreView email, set in uploader only |
| `LINK_UP_PASSWORD` | — | LibreView password, set in uploader only |
| `LINK_UP_REGION` | — | LibreView region, set in uploader only |
| `NIGHTSCOUT_URL` | — | Must be `http://glucoassist` (service name on shared network) |
| `API_SECRET` | — | Must be non-empty (uploader requirement); GlucoAssist currently accepts any value |
| — | `CGM_SOURCE` | Must be `librelink_push` |
| — | `APP_SECRET_KEY` | GlucoAssist session secret — generate a long random string |

### Notes

- **`API_SECRET` / `NIGHTSCOUT_TOKEN`** — The uploader requires this variable to be non-empty. GlucoAssist currently accepts push requests without validating it. Set it to any non-empty string. A future release (see [#81](https://github.com/reloadfast/GlucoAssist/issues/81)) will add optional secret validation so both sides can be configured with the same value.
- **Push endpoint** — The uploader POSTs to `/api/v1/entries`. Ensure this endpoint is reachable from the uploader container (it is, when using the provided `docker-compose.yml`). See [#80](https://github.com/reloadfast/GlucoAssist/issues/80) for the history of why a GET alias was added.
- **Backfill** — Set `LINK_UP_ALL_DATA=true` on the first run to import the full current sensor window. The push mode does not use GlucoAssist's `BACKFILL_DAYS` setting; backfill is driven by the uploader.
- **Scheduler** — In `librelink_push` mode, GlucoAssist's own ingest scheduler is disabled. Data arrives only when the uploader pushes.

---

## Option 3 — Poll a nightscout-librelink-up instance (`librelink`)

GlucoAssist polls an already-running nightscout-librelink-up instance for the latest readings.

```env
CGM_SOURCE=librelink
LIBRELINK_URL=http://192.168.1.x:7800   # base URL of the uploader
LIBRELINK_POLL_INTERVAL=300             # poll interval in seconds
```

LibreView credentials live in the uploader container. GlucoAssist only needs the URL.

---

## Option 4 — Nightscout (`nightscout`)

GlucoAssist polls a Nightscout instance using the Nightscout REST API.

```env
CGM_SOURCE=nightscout
NIGHTSCOUT_URL=http://192.168.1.x:1337
NIGHTSCOUT_TOKEN=your-api-secret   # raw API_SECRET value, minimum 12 characters
```

`NIGHTSCOUT_TOKEN` is the raw `API_SECRET` you set when deploying Nightscout. GlucoAssist sends it in the `API-SECRET` HTTP header.

| Deployment | Where to find `API_SECRET` |
|---|---|
| Docker / Compose | `API_SECRET` in `docker-compose.yml` or `docker inspect nightscout \| grep API_SECRET` |
| Heroku | App Settings → Config Vars → `API_SECRET` |
| Render / Railway | Environment tab → `API_SECRET` |
