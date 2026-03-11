from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ratios import DoseProposalResponse, RatioEstimate, RatiosResponse, TimeBlockRatio
from app.services.ratios import (
    MIN_SAMPLES,
    TIME_BLOCKS,
    _ci,
    _collect_cf_samples,
    _collect_icr_samples,
    get_dose_proposal,
)

router = APIRouter(prefix="/ratios", tags=["ratios"])

DISCLAIMER = (
    "These are observational estimates, not prescriptions. "
    "Consult your healthcare provider before adjusting insulin doses."
)


def _to_schema(est: object) -> RatioEstimate | None:
    if est is None:
        return None
    return RatioEstimate(
        mean=est.mean,  # type: ignore[union-attr]
        ci_lower=est.ci_lower,  # type: ignore[union-attr]
        ci_upper=est.ci_upper,  # type: ignore[union-attr]
        n=est.n,  # type: ignore[union-attr]
    )


@router.get("", response_model=RatiosResponse)
def get_ratios(
    days: int = Query(default=90, ge=14, le=365),
    db: Session = Depends(get_db),  # noqa: B008
) -> RatiosResponse:
    from datetime import UTC, datetime, timedelta

    since = datetime.now(UTC) - timedelta(days=days)
    icr_samples = _collect_icr_samples(db, since)
    cf_samples = _collect_cf_samples(db, since)

    blocks = []
    for block in TIME_BLOCKS:
        icr_list = icr_samples[block]
        cf_list = cf_samples[block]
        blocks.append(
            TimeBlockRatio(
                block=block,
                icr=_to_schema(_ci(icr_list) if len(icr_list) >= MIN_SAMPLES else None),
                cf=_to_schema(_ci(cf_list) if len(cf_list) >= MIN_SAMPLES else None),
                icr_samples=len(icr_list),
                cf_samples=len(cf_list),
                insufficient_data=(len(icr_list) < MIN_SAMPLES and len(cf_list) < MIN_SAMPLES),
            )
        )
    return RatiosResponse(
        blocks=blocks,
        days_analyzed=days,
        disclaimer=DISCLAIMER,
    )


@router.get("/dose-proposal", response_model=DoseProposalResponse)
def get_dose_proposal_endpoint(
    carbs_g: float = Query(..., gt=0, le=500, description="Carbohydrates in grams"),
    hour: int = Query(..., ge=0, le=23, description="Hour of day (0–23, local time)"),
    days: int = Query(default=90, ge=14, le=365, description="Look-back window for ICR estimation"),
    db: Session = Depends(get_db),  # noqa: B008
) -> DoseProposalResponse:
    return get_dose_proposal(db, hour=hour, carbs_g=carbs_g, days=days)
