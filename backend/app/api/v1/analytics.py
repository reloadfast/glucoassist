from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.glucose import GlucoseReading
from app.schemas.analytics import HbA1cResponse, PatternsResponse, StatsResponse
from app.services.analytics import compute_window_stats
from app.services.patterns import detect_patterns

router = APIRouter(prefix="/analytics", tags=["analytics"])

WINDOWS = [30, 60, 90]


def _glucose_values(db: Session, days: int) -> list[int]:
    since = datetime.now(UTC) - timedelta(days=days)
    rows = (
        db.query(GlucoseReading.glucose_mg_dl)
        .filter(GlucoseReading.timestamp >= since)
        .all()
    )
    return [r.glucose_mg_dl for r in rows]


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:  # noqa: B008
    windows = [compute_window_stats(_glucose_values(db, w), w) for w in WINDOWS]
    return StatsResponse(windows=windows)


@router.get("/hba1c", response_model=HbA1cResponse)
def get_hba1c(db: Session = Depends(get_db)) -> HbA1cResponse:  # noqa: B008
    stats = {w: compute_window_stats(_glucose_values(db, w), w) for w in WINDOWS}
    return HbA1cResponse(
        eag_30d=stats[30].eag,
        eag_60d=stats[60].eag,
        eag_90d=stats[90].eag,
        hba1c_30d=stats[30].hba1c,
        hba1c_60d=stats[60].hba1c,
        hba1c_90d=stats[90].hba1c,
    )


@router.get("/patterns", response_model=PatternsResponse)
def get_patterns(db: Session = Depends(get_db)) -> PatternsResponse:  # noqa: B008
    patterns = detect_patterns(db)
    return PatternsResponse(patterns=patterns)
