from pydantic import BaseModel


class HorizonForecast(BaseModel):
    horizon_min: int
    predicted_mg_dl: float
    ci_lower: float
    ci_upper: float
    p_hypo: float
    p_hyper: float
    risk_level: str  # "low" | "moderate" | "high" | "critical"


class ModelMeta(BaseModel):
    last_trained: str | None
    training_samples: int | None
    mae_per_horizon: dict[str, float] | None


class ForecastResponse(BaseModel):
    model_trained: bool
    forecasts: list[HorizonForecast]
    overall_risk: str  # "low" | "moderate" | "high" | "critical" | "unknown"
    meta: ModelMeta
