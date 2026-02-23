import logging
from datetime import UTC, datetime, timedelta

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


PAGE_SIZE = 1000  # readings per backfill request


def _nightscout_headers(token: str | None) -> dict[str, str]:
    return {"API-SECRET": token} if token else {}


def fetch_entries(url: str, token: str | None = None) -> list[dict]:
    """GET /api/v1/entries.json?count=20 from a Nightscout-compatible endpoint."""
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            f"{url.rstrip('/')}/api/v1/entries.json",
            params={"count": 20},
            headers=_nightscout_headers(token),
        )
        resp.raise_for_status()
        return resp.json()


def fetch_entries_page(
    url: str,
    token: str | None,
    since_ms: int,
    until_ms: int,
) -> list[dict]:
    """Fetch up to PAGE_SIZE entries in the half-open interval [since_ms, until_ms)."""
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(
            f"{url.rstrip('/')}/api/v1/entries.json",
            params={
                "find[date][$gte]": since_ms,
                "find[date][$lt]": until_ms,
                "count": PAGE_SIZE,
            },
            headers=_nightscout_headers(token),
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

    logger.info("Ingest: fetching from %s (source=%s)", url, settings.cgm_source)
    try:
        raw_entries = fetch_entries(url, token)
    except httpx.HTTPError as exc:
        logger.error("Ingest HTTP error from %s: %s", url, exc)
        return 0

    logger.info("Ingest: received %d raw entries", len(raw_entries))

    readings = []
    for raw in raw_entries:
        reading = parse_entry(raw)
        if reading is None:
            continue
        readings.append(reading)

    if not readings:
        logger.warning("Ingest: 0 sgv entries parsed from %d raw entries", len(raw_entries))
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


def _bulk_insert(db: Session, readings: list[GlucoseReading]) -> int:
    """Deduplicate by timestamp and insert. Returns count of new rows inserted."""
    if not readings:
        return 0
    timestamps = [r.timestamp for r in readings]
    existing = {
        row.timestamp
        for row in db.query(GlucoseReading.timestamp).filter(
            GlucoseReading.timestamp.in_(timestamps)
        )
    }
    new_rows = [r for r in readings if r.timestamp not in existing]
    if new_rows:
        db.add_all(new_rows)
        db.commit()
    return len(new_rows)


def run_backfill(db: Session, settings: Settings, days: int) -> int:
    """
    Import up to `days` of historical entries from the configured CGM source.

    Paginates backwards in time using Nightscout's date-range filter, inserting
    readings in batches of PAGE_SIZE.  Returns the total count of new rows inserted.
    """
    if settings.cgm_source == "librelink":
        url = settings.librelink_url
        token = None
    else:
        url = settings.nightscout_url
        token = settings.nightscout_token or None

    if not url:
        logger.warning(
            "Backfill: no CGM URL configured for source=%s — skipping", settings.cgm_source
        )
        return 0

    since = datetime.now(UTC) - timedelta(days=days)
    since_ms = int(since.timestamp() * 1000)
    until_ms = int(datetime.now(UTC).timestamp() * 1000)

    logger.info(
        "Backfill: importing up to %d days from %s (source=%s)",
        days,
        url,
        settings.cgm_source,
    )

    total_inserted = 0
    page = 0

    while until_ms > since_ms:
        page += 1
        try:
            raw_entries = fetch_entries_page(url, token, since_ms, until_ms)
        except httpx.HTTPError as exc:
            logger.error("Backfill: HTTP error on page %d: %s", page, exc)
            break

        if not raw_entries:
            logger.info("Backfill: no more entries — done after %d pages", page - 1)
            break

        readings = [r for raw in raw_entries if (r := parse_entry(raw)) is not None]
        inserted = _bulk_insert(db, readings)
        total_inserted += inserted

        # oldest entry in this page becomes the new upper bound
        oldest_ms = min((e.get("date", until_ms) for e in raw_entries), default=until_ms)
        logger.info(
            "Backfill page %d: %d raw / %d inserted (total so far: %d)",
            page,
            len(raw_entries),
            inserted,
            total_inserted,
        )

        if oldest_ms >= until_ms:
            break  # no progress — safety guard
        until_ms = oldest_ms - 1

        if len(raw_entries) < PAGE_SIZE:
            break  # last page reached

    logger.info("Backfill complete: %d new readings inserted over %d pages", total_inserted, page)
    return total_inserted
