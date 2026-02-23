# Docker Build & Test

Build the single-container image and verify it runs correctly.

## Build

```bash
docker build -t glucosense:dev .
```

Report build time and final image size.

## Run

```bash
docker run -d \
  --name glucosense-test \
  -p 3500:80 \
  -v glucosense-test-data:/data \
  --env-file .env \
  glucosense:dev
```

If `.env` does not exist, use `.env.example` and warn the user.

## Health check

```bash
sleep 3
curl -sf http://localhost:3500/api/health && echo "Backend OK"
curl -sf http://localhost:3500/ -o /dev/null && echo "Frontend OK"
docker logs glucosense-test --tail 30
```

## Cleanup

```bash
docker stop glucosense-test
docker rm glucosense-test
```

Do NOT remove the `glucosense-test-data` volume unless explicitly asked.

## Report

- Build: success/fail + image size
- Backend health: OK/FAIL
- Frontend static: OK/FAIL
- Any errors from logs
- Unraid template note: if ports or volumes changed during this session, prompt to run `/unraid-sync`
