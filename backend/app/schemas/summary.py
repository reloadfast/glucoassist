from pydantic import BaseModel

from app.schemas.glucose import GlucoseReadingOut


class SummaryResponse(BaseModel):
    latest_reading: GlucoseReadingOut | None
    avg_glucose: float | None
    min_glucose: int | None
    max_glucose: int | None
    time_in_range_pct: float | None
    reading_count: int
