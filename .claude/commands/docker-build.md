# Docker Build & Test

Build the single-container image and verify it runs correctly.

## Build

```bash
docker build -t glucoassist:dev .
```

Report build time and final image size.

## Run

```bash
docker run -d \
  --name glucoassist-test \
  -p 3500:80 \
  -v glucoassist-test-data:/data \
  --env-file .env \
  glucoassist:dev
```

If `.env` does not exist, use `.env.example` and warn the user.

## Health check

```bash
sleep 3
curl -sf http://localhost:3500/api/health && echo "Backend OK"
curl -sf http://localhost:3500/ -o /dev/null && echo "Frontend OK"
docker logs glucoassist-test --tail 30
```

## Cleanup

```bash
docker stop glucoassist-test
docker rm glucoassist-test
```

Do NOT remove the `glucoassist-test-data` volume unless explicitly asked.

## Report

- Build: success/fail + image size
- Backend health: OK/FAIL
- Frontend static: OK/FAIL
- Any errors from logs
