# Retrain Predictive Model

Trigger a manual model retrain and evaluate results.
Only available once Phase 4/5 ML pipeline is implemented.

## Trigger retrain via API

```bash
curl -X POST http://localhost:3500/api/v1/ml/retrain \
  -H "Content-Type: application/json"
```

Monitor progress:
```bash
curl -sf http://localhost:3500/api/v1/ml/status
```

## Evaluate results

After retrain completes, read the evaluation output:
- Training data window (start → end, record count)
- MAE per horizon (30/60/120 min)
- RMSE per horizon
- Within-CI% (what % of actual values fell inside the predicted confidence interval)
- Compare vs previous model metrics

## Promote decision

- If new model metrics are better across all horizons: promote automatically
- If mixed results: report to user and ask before promoting
- If worse: keep current model, report findings

## Model artefacts location

`/data/models/` inside the container — verify the new artefact exists after retrain.

## Notes

- Minimum data requirement before retraining: check `backend/app/services/ml/config.py`
- Never retrain with fewer than 14 days of CGM data
