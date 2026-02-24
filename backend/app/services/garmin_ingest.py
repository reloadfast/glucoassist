import logging
import os
import time
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.health import HealthMetric

logger = logging.getLogger(__name__)

MIN_INTERVAL_SECONDS = 3600  # enforced floor regardless of config
_MAX_RETRIES = 3


def _today_utc() -> date:
    return datetime.now(UTC).date()


def _day_start(d: date) -> datetime:
    """Midnight UTC for the given date as a naive datetime (matches DB storage convention)."""
    return datetime.combine(d, datetime.min.time())


def _already_ingested(db: Session, target_date: date) -> bool:
    start = _day_start(target_date)
    end = start + timedelta(days=1)
    return (
        db.query(HealthMetric)
        .filter(
            HealthMetric.source == "garmin",
            HealthMetric.timestamp >= start,
            HealthMetric.timestamp < end,
        )
        .first()
        is not None
    )


def _parse_rhr(stats: dict) -> int | None:
    val = stats.get("restingHeartRate")
    return int(val) if val is not None else None


def _parse_weight(body: dict | None) -> float | None:
    if not body:
        return None
    avg = body.get("totalAverage") or {}
    grams = avg.get("weight")
    if grams is None:
        return None
    return round(float(grams) / 1000, 1)  # grams → kg


def _parse_sleep(sleep: dict | None) -> float | None:
    if not sleep:
        return None
    dto = sleep.get("dailySleepDTO") or {}
    seconds = dto.get("sleepTimeSeconds")
    if seconds is None:
        return None
    return round(float(seconds) / 3600, 2)  # seconds → hours


def _parse_stress(stress: dict | None) -> int | None:
    if not stress:
        return None
    val = stress.get("avgStressLevel") or stress.get("overallStressLevel")
    return int(val) if val is not None else None


def run_garmin_ingest(db: Session, settings: Settings) -> int:
    """
    Fetch today's Garmin health data and upsert into health_metrics.
    Returns 1 if a new row was inserted, 0 otherwise.
    Enforces MIN_INTERVAL_SECONDS floor and uses exponential backoff on 429.
    """
    if not settings.garmin_enabled:
        return 0

    if not settings.garmin_username or not settings.garmin_password:
        logger.warning("Garmin: GARMIN_USERNAME/GARMIN_PASSWORD not set — skipping ingest")
        return 0

    target_date = _today_utc()

    if _already_ingested(db, target_date):
        logger.info("Garmin: entry for %s already exists — skipping", target_date)
        return 0

    try:
        from garminconnect import (  # noqa: PLC0415
            Garmin,
            GarminConnectAuthenticationError,
            GarminConnectConnectionError,
            GarminConnectTooManyRequestsError,
        )
        from garth.exc import GarthException, GarthHTTPError  # noqa: PLC0415
    except ImportError:
        logger.error("Garmin: garminconnect package not installed")
        return 0

    date_str = target_date.isoformat()
    tokenstore = settings.garmin_tokenstore
    _token_files = ("oauth1_token.json", "oauth2_token.json")
    has_tokens = bool(tokenstore) and all(
        os.path.exists(os.path.join(tokenstore, f)) for f in _token_files
    )

    for attempt in range(_MAX_RETRIES):
        try:
            client = Garmin(settings.garmin_username, settings.garmin_password)

            if has_tokens:
                logger.debug("Garmin: loading cached tokens from %s", tokenstore)
                client.login(tokenstore=tokenstore)
            else:
                client.login()
                if tokenstore:
                    client.garth.dump(tokenstore)
                    logger.info("Garmin: tokens saved to %s", tokenstore)

            rhr = _parse_rhr(client.get_stats(date_str) or {})
            weight = _parse_weight(client.get_body_composition(date_str))
            sleep_hours = _parse_sleep(client.get_sleep_data(date_str))
            stress_level = _parse_stress(client.get_stress_data(date_str))

            metric = HealthMetric(
                timestamp=_day_start(target_date),
                heart_rate_bpm=rhr,
                weight_kg=weight,
                sleep_hours=sleep_hours,
                stress_level=stress_level,
                source="garmin",
                notes=f"Auto-imported from Garmin ({date_str})",
            )
            db.add(metric)
            db.commit()
            logger.info("Garmin: inserted health metric for %s", target_date)
            return 1

        except GarminConnectTooManyRequestsError:
            wait = (2**attempt) * 60  # 60s, 120s, 240s
            if attempt < _MAX_RETRIES - 1:
                logger.warning(
                    "Garmin: rate limited (429) — waiting %ds before retry %d/%d",
                    wait,
                    attempt + 1,
                    _MAX_RETRIES,
                )
                time.sleep(wait)
            else:
                logger.error("Garmin: max retries exceeded after rate limiting")
                return 0

        except GarminConnectAuthenticationError:
            logger.error("Garmin: authentication failed — check GARMIN_USERNAME/GARMIN_PASSWORD")
            return 0

        except GarthHTTPError as exc:
            if "401" in str(exc):
                logger.error(
                    "Garmin: authentication failed (401) — if MFA is enabled on your account, "
                    "pre-seed tokens by running: python scripts/garmin_login.py"
                )
            else:
                logger.error("Garmin: HTTP error from garth: %s", exc)
            return 0

        except GarthException as exc:
            if "Unexpected title" in str(exc):
                logger.error(
                    "Garmin: account uses Google/Apple sign-in — native credentials required. "
                    "Set a Garmin password via 'Forgot Password' at connect.garmin.com, "
                    "then update GARMIN_PASSWORD and re-run: "
                    "docker exec -it glucoassist python /app/scripts/garmin_login.py"
                )
            else:
                logger.error("Garmin: SSO error: %s", exc)
            return 0

        except GarminConnectConnectionError as exc:
            logger.error("Garmin: connection error: %s", exc)
            return 0

        except Exception:
            logger.exception("Garmin: unexpected error during ingest")
            return 0

    return 0
