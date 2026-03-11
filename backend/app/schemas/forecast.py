from pydantic import BaseModel

_DISCLAIMER = "Decision-support only — always follow guidance from your healthcare team."


class HorizonForecast(BaseModel):
    horizon_min: int
    predicted_mg_dl: float
    ci_lower: float
    ci_upper: float
    p_hypo: float
    p_hyper: float
    risk_level: str  # "low" | "moderate" | "high" | "critical"


class ActionSuggestion(BaseModel):
    type: str  # "ok"|"hypo_treat"|"hypo_warn"|"hyper_correct"|"hyper_warn"
    urgency: str  # "low"|"moderate"|"high"|"critical"
    message: str
    detail: str | None = None
    disclaimer: str = _DISCLAIMER


class ModelMeta(BaseModel):
    last_trained: str | None
    training_samples: int | None
    mae_per_horizon: dict[str, float] | None


class ForecastResponse(BaseModel):
    model_trained: bool
    forecasts: list[HorizonForecast]
    overall_risk: str  # "low" | "moderate" | "high" | "critical" | "unknown"
    meta: ModelMeta
    suggestions: list[ActionSuggestion] = []
