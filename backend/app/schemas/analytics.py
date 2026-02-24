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


class BasalWindowBlock(BaseModel):
    block_label: str
    hour_start: int
    hour_end: int
    median: float | None
    p10: float | None
    p25: float | None
    p75: float | None
    p90: float | None
    n: int
    nights: int


class BasalWindowResponse(BaseModel):
    blocks: list[BasalWindowBlock]
    nights_analyzed: int
    tz: str
