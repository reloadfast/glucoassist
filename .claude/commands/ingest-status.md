# Check CGM Ingest Status

Verify the data ingest pipeline is healthy and receiving CGM data.

## Running container check

```bash
curl -sf http://localhost:3500/api/health
curl -sf http://localhost:3500/api/v1/glucose?limit=5
```

Report:
- Last received reading: timestamp + glucose value + trend
- Time since last reading (flag if > 10 minutes)
- Source (librelink / nightscout)

## Logs check

```bash
docker logs glucosense --tail 50 | grep -E "(ingest|error|warn|ERROR|WARN)"
```

Flag any repeated errors or connection failures.

## Environment check

Verify env vars are set (do NOT print values):
- `CGM_SOURCE` is set
- `LIBRELINK_URL` or `NIGHTSCOUT_URL` is set (whichever matches CGM_SOURCE)
- `INGEST_INTERVAL_SECONDS` is set

## Summary

- Status: HEALTHY / DEGRADED / DOWN
- Last reading: <timestamp> — <value> mg/dL <trend>
- Any errors to investigate
