# Forecast Model

GlucoAssist predicts your blood glucose at **30, 60, and 120 minutes** from now using machine-learning models trained entirely on your own CGM history. No external data, no cloud compute — everything runs inside the container.

> **Decision-support only.** Forecasts are probabilistic estimates, not clinical prescriptions. Always apply your own clinical judgement and follow guidance from your healthcare team.

---

## What the forecast does

Each forecast horizon produces:

| Output | Meaning |
|---|---|
| Predicted glucose (mg/dL) | Point estimate of your glucose at that horizon |
| Confidence interval | Lower and upper bounds (95% CI) |
| P(hypo) | Probability your glucose will fall below 70 mg/dL |
| P(hyper) | Probability your glucose will rise above 180 mg/dL |
| Risk level | `low` / `moderate` / `high` based on P(hypo) or P(hyper) |

The **overall risk** shown in the Risk Alert card is the worst risk level across all three horizons.

---

## What feeds the model

For each prediction the model receives the following features:

| Feature | Description |
|---|---|
| Last 6 glucose readings | 30-minute window of recent values |
| Glucose rate of change | mg/dL per minute, derived from the last 2 readings |
| Glucose acceleration | Second derivative (rate of change of rate of change) |
| Time of day | Sine/cosine encoding of the hour (captures circadian rhythm) |
| Day of week | Sine/cosine encoding (captures weekend vs weekday patterns) |
| Insulin on Board (IOB) | Estimated active insulin using a 65-minute linear decay model |

IOB is calculated from logged insulin doses. If you don't log insulin, IOB is always 0 and the model will compensate over time, but accuracy will be lower for correction bolus scenarios.

---

## How the model is trained

### Algorithm

GlucoAssist uses **Ridge regression** — a regularised linear model. Ridge is well-suited for this task because:

- It generalises well with a few hundred training samples.
- It resists overfitting when features are correlated (as glucose readings over time are).
- It is fast to train, enabling frequent retraining without a noticeable performance penalty.

A separate Ridge model is trained for each horizon (30 min, 60 min, 120 min).

### Training data

The training dataset is built from your glucose history as a sliding window:

- Each sample is a (features at time T) → (glucose at time T + horizon) pair.
- Samples where the target reading is missing are excluded.
- A minimum of **288 readings** (approximately one full day of CGM data) is required before any model is trained.

### Retraining schedule

- Models are retrained automatically every **24 hours** when new data has accumulated.
- You can trigger an immediate retrain from the **Settings** page.
- Training runs in a background thread and does not interrupt data ingest.

### Model promotion

A freshly trained model only replaces the live (serving) model if it strictly improves **mean absolute error (MAE) across all three horizons**. If the new model is worse on any horizon the previous model is kept. This prevents a noisy retraining run from degrading live predictions.

The last 50 training events are stored in the **Retrain Log** on the Settings page.

---

## Accuracy and limitations

| Horizon | Typical MAE |
|---|---|
| 30 min | ~8–12 mg/dL |
| 60 min | ~12–18 mg/dL |
| 120 min | ~18–28 mg/dL |

MAE increases with horizon because glucose dynamics are harder to predict further out. The actual MAE for your model is shown in the Settings page under **Forecast Model**.

### Known limitations

- **Unlogged meals.** An unexpected carb load will not be reflected in the forecast until its glucose effect is visible in the CGM trace.
- **Sensor lag.** CGM readings lag interstitial fluid, which lags blood glucose. The model learns your sensor's typical lag implicitly but cannot eliminate it.
- **Exercise and illness.** Acute changes in insulin sensitivity are not directly modelled. The model will adapt over the next few retraining cycles, but may be less accurate during unusual physiological events.
- **IOB accuracy.** The linear 65-minute decay model is a simplification. Rapid-acting analogues (Humalog, NovoRapid, Fiasp) have non-linear activity curves. Log insulin doses promptly and accurately for best results.
- **Insufficient history.** With fewer than ~3 days of data the model may show wider confidence intervals and higher MAE. Accuracy improves as your history grows.

---

## Data requirements for best results

| Action | Why it helps |
|---|---|
| Log every insulin dose promptly | IOB is calculated from your log; missing doses → IOB underestimation |
| Log meals with carb estimates | Meal events help the model learn your post-meal response pattern |
| Keep the CGM sensor calibrated | Accurate CGM readings = accurate training targets |
| Allow data to accumulate | At least 7–14 days of paired CGM + insulin data improves personalisation |
