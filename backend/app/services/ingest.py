import logging
from datetime import UTC, datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.glucose import GlucoseReading

logger = logging.getLogger(__name__)

TREND_MAP = {
    "DoubleUp": "DoubleUp",
    "SingleUp": "SingleUp",
    "FortyFiveUp": "FortyFiveUp",
    "Flat": "Flat",
    "FortyFiveDown": "FortyFiveDown",
    "SingleDown": "SingleDown",
    "DoubleDown": "DoubleDown",
    "NOT COMPUTABLE": None,
    "RATE OUT OF RANGE": None,
    "None": None,
}


def fetch_entries(url: str, token: str | None = None) -> list[dict]:
    """GET /api/v1/entries.json?count=20 from a Nightscout-compatible endpoint."""
    headers = {}
    if token:
        headers["API-SECRET"] = token

    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            f"{url.rstrip('/')}/api/v1/entries.json", params={"count": 20}, headers=headers
        )
        resp.raise_for_status()
        return resp.json()


def parse_entry(raw: dict) -> GlucoseReading | None:
    """Map a raw Nightscout entry dict to a GlucoseReading. Returns None for non-sgv types."""
    if raw.get("type") != "sgv":
        return None

    sgv = raw.get("sgv")
    if sgv is None:
        return None

    # 'date' is epoch ms in Nightscout
    date_ms = raw.get("date")
    if date_ms is None:
        return None

    # Store as naive UTC — SQLite DateTime doesn't preserve tz info
    timestamp = datetime.fromtimestamp(date_ms / 1000.0, tz=UTC).replace(tzinfo=None)

    direction = raw.get("direction")
    trend_arrow = TREND_MAP.get(direction, direction) if direction else None

    device = raw.get("device")

    return GlucoseReading(
        timestamp=timestamp,
        glucose_mg_dl=int(sgv),
        trend_arrow=trend_arrow,
        source="librelink" if "libre" in str(device or "").lower() else "nightscout",
        device_id=device,
    )


def run_ingest(db: Session, settings: Settings) -> int:
    """Fetch entries, parse, deduplicate by timestamp, and bulk insert. Returns count inserted."""
    if settings.cgm_source == "librelink":
        url = settings.librelink_url
        token = None
    else:
        url = settings.nightscout_url
        token = settings.nightscout_token or None

    if not url:
        logger.warning("No CGM URL configured for source=%s — skipping ingest", settings.cgm_source)
        return 0

    try:
        raw_entries = fetch_entries(url, token)
    except httpx.HTTPError as exc:
        logger.error("HTTP error during ingest: %s", exc)
        return 0

    readings = []
    for raw in raw_entries:
        reading = parse_entry(raw)
        if reading is None:
            continue
        readings.append(reading)

    if not readings:
        return 0

    # Deduplicate: collect timestamps already in DB
    timestamps = [r.timestamp for r in readings]
    existing = {
        row.timestamp
        for row in db.query(GlucoseReading.timestamp).filter(
            GlucoseReading.timestamp.in_(timestamps)
        )
    }

    new_readings = [r for r in readings if r.timestamp not in existing]
    if new_readings:
        db.add_all(new_readings)
        db.commit()

    skipped = len(readings) - len(new_readings)
    logger.info(
        "Ingest: %d new readings inserted (skipped %d duplicates)", len(new_readings), skipped
    )
    return len(new_readings)
