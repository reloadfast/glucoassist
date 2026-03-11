# GlucoAssist Forecast Research Program

## Goal

Improve the glucose forecasting model used in GlucoAssist.
The current model is Ridge regression. Your job is to propose, implement, and evaluate
alternative approaches — one at a time — against a fixed validation set drawn from the
user's local SQLite CGM database.

A candidate model is **promoted** only if it beats all three MAE baselines simultaneously.

## Current Baseline (to beat)

| Horizon | MAE (mg/dL) |
|---------|-------------|
| 30 min  | 17.74       |
| 60 min  | 25.18       |
| 120 min | 28.60       |

These were measured on a dataset of ~25,653 training samples at ~5-minute resolution
(approximately 88 days of continuous CGM data).

## Data Available

All data lives in the local SQLite database at `DATABASE_PATH` (default `/data/glucoassist.db`).

Relevant tables:
- `glucose_readings` — timestamp, glucose_mg_dl, trend
- `garmin_metrics` — date, resting_hr, weight_kg, sleep_hours, stress_level (may be sparse)

A 5-minute cadence should be assumed. Readings may have occasional gaps (sensor changes,
connection drops) — handle them gracefully (forward-fill up to 15 min, then mark as missing).

## Feature Ideas to Explore

The agent should explore these in order of expected payoff. Each experiment must change
**one thing at a time** relative to the previous best model.

### Tier 1 — Low risk, high expected gain
1. **Richer lag window**: Current Ridge likely uses lags [1, 2, 3, 6, 12]. Try extending
   to [1, 2, 3, 6, 12, 18, 24, 36] (covering 3 hours of history).
2. **Time-of-day encoding**: Add `sin(2π * hour/24)` and `cos(2π * hour/24)` as features.
   Dawn phenomenon and post-meal patterns are strongly time-dependent.
3. **Rate-of-change features**: First and second derivative of glucose over the last 15 and
   30 minutes. The CGM trend arrow is already doing this qualitatively — make it quantitative.

### Tier 2 — Model alternatives to Ridge
4. **LightGBM**: Drop-in replacement with identical feature set. Likely to outperform Ridge
   on non-linear patterns (exercise-induced hypo rebound, stress hyperglycaemia).
5. **Separate models per horizon**: Instead of one model for all three horizons, train three
   independent models. The optimal feature set for 30 min vs 120 min may differ substantially.
6. **XGBoost with early stopping**: Use the validation set as the early-stop holdout.

### Tier 3 — Garmin integration (only if Garmin data is populated)
7. **Stress × glucose interaction**: Add `stress_level * glucose_lag_1` as a cross-feature.
8. **Sleep quality lag**: Prior night's sleep hours as a feature — nocturnal hypoglycaemia
   and dawn phenomenon are both sleep-stage-dependent.

### Tier 4 — Architectural changes (highest risk, potentially highest reward)
9. **Small LSTM (16 hidden units)**: Input = last 12 readings + time features. Avoid
   overfitting with dropout=0.2. Should train in under 60 seconds on CPU with 25k samples.
10. **Ensemble of Ridge + LightGBM**: Weighted average of predictions from the best
    tree-based model and the current Ridge baseline.

## Evaluation Protocol

Use **time-series cross-validation**, not random split. This is critical — random splitting
leaks future glucose values into the training set and produces optimistic MAE estimates.

```
Walk-forward validation:
  - Minimum training window: 14 days (4,032 readings at 5-min cadence)
  - Validation window: 7 days (2,016 readings)
  - Step: 7 days
  - Number of folds: as many as data allows (expect ~8–10 folds on 88 days)
  - Final MAE = mean across all folds
```

For each fold and each horizon (30, 60, 120 min):
- Predict glucose at t+6, t+12, t+24 steps (5-min resolution)
- MAE = mean(|predicted - actual|) in mg/dL
- Skip predictions where the actual reading is missing

## Promotion Criteria

A new model is promoted if and only if:
- MAE_30 < 17.74 **AND**
- MAE_60 < 25.18 **AND**
- MAE_120 < 28.60

If only one or two horizons improve, log it but do not promote. The 30-min horizon is the
most clinically important (hypo prevention), so optimise for it first if there is a trade-off.

## Clinical Safety Note

This is a personal analytics tool, not a medical device. However, the agent should be aware
that false-low predictions (predicting glucose will be higher than it actually becomes)
are more dangerous than false-high predictions, because they delay the user's response
to hypoglycaemia. All else equal, prefer models with lower error in the hypoglycaemic
range (glucose < 70 mg/dL).

## Output Format

After each experiment, write a result block to `research_log.jsonl`:

```json
{
  "timestamp": "2026-03-11T22:00:00",
  "experiment_id": "exp_003",
  "description": "LightGBM with extended lags and time-of-day encoding",
  "mae_30": 15.21,
  "mae_60": 22.87,
  "mae_120": 27.10,
  "promoted": true,
  "notes": "Biggest gain at 30-min horizon. 120-min barely improved."
}
```

## Integration Target

The promoted model must be drop-in compatible with GlucoAssist's existing prediction
interface. The backend expects a function with signature:

```python
def predict(db_path: str) -> dict:
    """
    Returns predictions for the most recent CGM reading.
    Output: {
        "glucose_30": float,   # mg/dL
        "glucose_60": float,
        "glucose_120": float,
        "confidence_30": float,  # 0–1
        "confidence_60": float,
        "confidence_120": float,
        "hypo_risk_30": float,   # probability glucose < 70
        "hypo_risk_60": float,
        "hypo_risk_120": float,
    }
    """
```

Confidence should be derived from the model's uncertainty estimate (prediction interval
width, or if unavailable, from historical MAE scaled to 0–1).
