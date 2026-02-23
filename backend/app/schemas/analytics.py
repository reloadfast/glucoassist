from pydantic import BaseModel


class WindowStats(BaseModel):
    window_days: int
    reading_count: int
    avg_glucose: float | None
    sd: float | None
    cv_pct: float | None
    tir_pct: float | None
    tbr_pct: float | None
    tar_pct: float | None
    eag: float | None
    hba1c: float | None


class StatsResponse(BaseModel):
    windows: list[WindowStats]


class HbA1cResponse(BaseModel):
    eag_30d: float | None
    eag_60d: float | None
    eag_90d: float | None
    hba1c_30d: float | None
    hba1c_60d: float | None
    hba1c_90d: float | None


class PatternItem(BaseModel):
    name: str
    detected: bool
    description: str
    confidence: float | None


class PatternsResponse(BaseModel):
    patterns: list[PatternItem]
