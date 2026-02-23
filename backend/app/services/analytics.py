"""Pure-function analytics: TIR, SD, CV, eAG, HbA1c — no DB access."""
import statistics

from app.schemas.analytics import WindowStats

LOW_MG_DL = 70
HIGH_MG_DL = 180


def compute_window_stats(values: list[int], window_days: int) -> WindowStats:
    """Compute glycaemic stats for a list of glucose readings (mg/dL)."""
    n = len(values)
    if n == 0:
        return WindowStats(
            window_days=window_days,
            reading_count=0,
            avg_glucose=None,
            sd=None,
            cv_pct=None,
            tir_pct=None,
            tbr_pct=None,
            tar_pct=None,
            eag=None,
            hba1c=None,
        )

    avg = statistics.mean(values)
    sd = round(statistics.stdev(values), 1) if n >= 2 else None
    cv_pct = round(sd / avg * 100, 1) if (sd is not None and avg > 0) else None
    tir_pct = round(sum(1 for v in values if LOW_MG_DL <= v <= HIGH_MG_DL) / n * 100, 1)
    tbr_pct = round(sum(1 for v in values if v < LOW_MG_DL) / n * 100, 1)
    tar_pct = round(sum(1 for v in values if v > HIGH_MG_DL) / n * 100, 1)
    eag = round(avg, 1)
    hba1c = round((eag + 46.7) / 28.7, 1)

    return WindowStats(
        window_days=window_days,
        reading_count=n,
        avg_glucose=round(avg, 1),
        sd=sd,
        cv_pct=cv_pct,
        tir_pct=tir_pct,
        tbr_pct=tbr_pct,
        tar_pct=tar_pct,
        eag=eag,
        hba1c=hba1c,
    )
