"""
Tests for:
- GET /api/v1/garmin/ingest-log
- run_garmin_ingest service logic (all outcome paths)
"""
from datetime import UTC, date, datetime
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models.garmin_ingest_log import GarminIngestLog
from app.models.health import HealthMetric
from app.services.garmin_ingest import _already_ingested, _day_start, run_garmin_ingest


# ── helpers ────────────────────────────────────────────────────────────────────

def _settings(enabled=True, username="u@example.com", password="pw", tokenstore=""):
    s = MagicMock()
    s.garmin_enabled = enabled
    s.garmin_username = username
    s.garmin_password = password
    s.garmin_tokenstore = tokenstore
    return s


def _make_client(rhr=60, weight_grams=70000, sleep_seconds=28800, stress=30):
    """Return a mock Garmin client that returns parseable data."""
    client = MagicMock()
    client.get_stats.return_value = {"restingHeartRate": rhr}
    client.get_body_composition.return_value = {
        "totalAverage": {"weight": weight_grams}
    }
    client.get_sleep_data.return_value = {
        "dailySleepDTO": {"sleepTimeSeconds": sleep_seconds}
    }
    client.get_stress_data.return_value = {"avgStressLevel": stress}
    return client


def _make_null_client():
    """Return a mock Garmin client that returns all-null data."""
    client = MagicMock()
    client.get_stats.return_value = {}
    client.get_body_composition.return_value = None
    client.get_sleep_data.return_value = None
    client.get_stress_data.return_value = None
    return client


# ── _already_ingested ──────────────────────────────────────────────────────────

@pytest.mark.unit
def test_already_ingested_returns_false_when_no_row(db_session: Session) -> None:
    assert _already_ingested(db_session, date(2026, 1, 1)) is False


@pytest.mark.unit
def test_already_ingested_returns_true_when_row_has_data(db_session: Session) -> None:
    row = HealthMetric(
        timestamp=_day_start(date(2026, 1, 1)),
        heart_rate_bpm=60,
        source="garmin",
    )
    db_session.add(row)
    db_session.commit()
    assert _already_ingested(db_session, date(2026, 1, 1)) is True


@pytest.mark.unit
def test_already_ingested_returns_false_for_all_null_row(db_session: Session) -> None:
    """An all-null row (empty outcome) must NOT block retry."""
    row = HealthMetric(
        timestamp=_day_start(date(2026, 1, 2)),
        heart_rate_bpm=None,
        weight_kg=None,
        sleep_hours=None,
        stress_level=None,
        source="garmin",
    )
    db_session.add(row)
    db_session.commit()
    assert _already_ingested(db_session, date(2026, 1, 2)) is False


# ── run_garmin_ingest outcome paths ───────────────────────────────────────────

_GARMIN_IMPORTS = {
    "Garmin": None,  # replaced per-test
    "GarminConnectAuthenticationError": Exception,
    "GarminConnectConnectionError": Exception,
    "GarminConnectTooManyRequestsError": Exception,
}


def _patch_garmin(client_mock):
    """Patch garminconnect and garth imports inside garmin_ingest module."""
    import garminconnect
    import garth.exc as garth_exc

    return patch.multiple(
        "app.services.garmin_ingest",
        **{},  # we use patch.object instead
    )


@pytest.mark.unit
def test_outcome_skipped_when_disabled(db_session: Session) -> None:
    result = run_garmin_ingest(db_session, _settings(enabled=False))
    assert result == 0
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "skipped"


@pytest.mark.unit
def test_outcome_skipped_when_no_credentials(db_session: Session) -> None:
    result = run_garmin_ingest(db_session, _settings(username="", password=""))
    assert result == 0
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "skipped"


@pytest.mark.unit
def test_outcome_success(db_session: Session) -> None:
    client = _make_client()

    class FakeGarmin:
        def __init__(self, *a, **kw): pass
        def login(self, **kw): pass
        def get_stats(self, d): return {"restingHeartRate": 60}
        def get_body_composition(self, d): return {"totalAverage": {"weight": 70000}}
        def get_sleep_data(self, d): return {"dailySleepDTO": {"sleepTimeSeconds": 28800}}
        def get_stress_data(self, d): return {"avgStressLevel": 30}

    class FakeExceptions:
        class GarminConnectAuthenticationError(Exception): pass
        class GarminConnectConnectionError(Exception): pass
        class GarminConnectTooManyRequestsError(Exception): pass

    class FakeGarth:
        class GarthHTTPError(Exception): pass
        class GarthException(Exception): pass

    with patch.dict("sys.modules", {
        "garminconnect": MagicMock(
            Garmin=FakeGarmin,
            GarminConnectAuthenticationError=FakeExceptions.GarminConnectAuthenticationError,
            GarminConnectConnectionError=FakeExceptions.GarminConnectConnectionError,
            GarminConnectTooManyRequestsError=FakeExceptions.GarminConnectTooManyRequestsError,
        ),
        "garth": MagicMock(),
        "garth.exc": MagicMock(
            GarthHTTPError=FakeGarth.GarthHTTPError,
            GarthException=FakeGarth.GarthException,
        ),
    }):
        result = run_garmin_ingest(db_session, _settings())

    assert result == 1
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "success"
    assert log.fields_populated == "rhr,weight,sleep,stress"
    metric = db_session.query(HealthMetric).one()
    assert metric.heart_rate_bpm == 60


@pytest.mark.unit
def test_outcome_partial(db_session: Session) -> None:
    """Only RHR returned — partial outcome, row is still committed."""
    class FakeGarmin:
        def __init__(self, *a, **kw): pass
        def login(self, **kw): pass
        def get_stats(self, d): return {"restingHeartRate": 55}
        def get_body_composition(self, d): return None
        def get_sleep_data(self, d): return None
        def get_stress_data(self, d): return None

    class FakeExceptions:
        class GarminConnectAuthenticationError(Exception): pass
        class GarminConnectConnectionError(Exception): pass
        class GarminConnectTooManyRequestsError(Exception): pass

    class FakeGarth:
        class GarthHTTPError(Exception): pass
        class GarthException(Exception): pass

    with patch.dict("sys.modules", {
        "garminconnect": MagicMock(
            Garmin=FakeGarmin,
            GarminConnectAuthenticationError=FakeExceptions.GarminConnectAuthenticationError,
            GarminConnectConnectionError=FakeExceptions.GarminConnectConnectionError,
            GarminConnectTooManyRequestsError=FakeExceptions.GarminConnectTooManyRequestsError,
        ),
        "garth": MagicMock(),
        "garth.exc": MagicMock(
            GarthHTTPError=FakeGarth.GarthHTTPError,
            GarthException=FakeGarth.GarthException,
        ),
    }):
        result = run_garmin_ingest(db_session, _settings())

    assert result == 1
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "partial"
    assert "rhr" in log.fields_populated
    metric = db_session.query(HealthMetric).one()
    assert metric.heart_rate_bpm == 55


@pytest.mark.unit
def test_outcome_empty(db_session: Session) -> None:
    """All-null response — no row committed, empty outcome logged."""
    class FakeGarmin:
        def __init__(self, *a, **kw): pass
        def login(self, **kw): pass
        def get_stats(self, d): return {}
        def get_body_composition(self, d): return None
        def get_sleep_data(self, d): return None
        def get_stress_data(self, d): return None

    class FakeExceptions:
        class GarminConnectAuthenticationError(Exception): pass
        class GarminConnectConnectionError(Exception): pass
        class GarminConnectTooManyRequestsError(Exception): pass

    class FakeGarth:
        class GarthHTTPError(Exception): pass
        class GarthException(Exception): pass

    with patch.dict("sys.modules", {
        "garminconnect": MagicMock(
            Garmin=FakeGarmin,
            GarminConnectAuthenticationError=FakeExceptions.GarminConnectAuthenticationError,
            GarminConnectConnectionError=FakeExceptions.GarminConnectConnectionError,
            GarminConnectTooManyRequestsError=FakeExceptions.GarminConnectTooManyRequestsError,
        ),
        "garth": MagicMock(),
        "garth.exc": MagicMock(
            GarthHTTPError=FakeGarth.GarthHTTPError,
            GarthException=FakeGarth.GarthException,
        ),
    }):
        result = run_garmin_ingest(db_session, _settings())

    assert result == 0
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "empty"
    assert db_session.query(HealthMetric).count() == 0


@pytest.mark.unit
def test_outcome_auth_error(db_session: Session) -> None:
    class AuthError(Exception): pass

    class FakeGarmin:
        def __init__(self, *a, **kw): pass
        def login(self, **kw): raise AuthError("bad creds")

    class FakeExceptions:
        GarminConnectAuthenticationError = AuthError
        class GarminConnectConnectionError(Exception): pass
        class GarminConnectTooManyRequestsError(Exception): pass

    class FakeGarth:
        class GarthHTTPError(Exception): pass
        class GarthException(Exception): pass

    with patch.dict("sys.modules", {
        "garminconnect": MagicMock(
            Garmin=FakeGarmin,
            GarminConnectAuthenticationError=FakeExceptions.GarminConnectAuthenticationError,
            GarminConnectConnectionError=FakeExceptions.GarminConnectConnectionError,
            GarminConnectTooManyRequestsError=FakeExceptions.GarminConnectTooManyRequestsError,
        ),
        "garth": MagicMock(),
        "garth.exc": MagicMock(
            GarthHTTPError=FakeGarth.GarthHTTPError,
            GarthException=FakeGarth.GarthException,
        ),
    }):
        result = run_garmin_ingest(db_session, _settings())

    assert result == 0
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "auth_error"


@pytest.mark.unit
def test_outcome_connection_error(db_session: Session) -> None:
    class ConnError(Exception): pass

    class FakeGarmin:
        def __init__(self, *a, **kw): pass
        def login(self, **kw): raise ConnError("timeout")

    class FakeExceptions:
        class GarminConnectAuthenticationError(Exception): pass
        GarminConnectConnectionError = ConnError
        class GarminConnectTooManyRequestsError(Exception): pass

    class FakeGarth:
        class GarthHTTPError(Exception): pass
        class GarthException(Exception): pass

    with patch.dict("sys.modules", {
        "garminconnect": MagicMock(
            Garmin=FakeGarmin,
            GarminConnectAuthenticationError=FakeExceptions.GarminConnectAuthenticationError,
            GarminConnectConnectionError=FakeExceptions.GarminConnectConnectionError,
            GarminConnectTooManyRequestsError=FakeExceptions.GarminConnectTooManyRequestsError,
        ),
        "garth": MagicMock(),
        "garth.exc": MagicMock(
            GarthHTTPError=FakeGarth.GarthHTTPError,
            GarthException=FakeGarth.GarthException,
        ),
    }):
        result = run_garmin_ingest(db_session, _settings())

    assert result == 0
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "connection_error"


@pytest.mark.unit
def test_outcome_skipped_when_already_ingested(db_session: Session) -> None:
    """If a row with data already exists, log skipped and return 0."""
    from app.services.garmin_ingest import _today_utc
    today = _today_utc()
    row = HealthMetric(
        timestamp=_day_start(today),
        heart_rate_bpm=65,
        source="garmin",
    )
    db_session.add(row)
    db_session.commit()

    result = run_garmin_ingest(db_session, _settings())
    assert result == 0
    log = db_session.query(GarminIngestLog).one()
    assert log.outcome == "skipped"


# ── GET /garmin/ingest-log ─────────────────────────────────────────────────────

@pytest.mark.unit
async def test_get_ingest_log_empty(client: AsyncClient) -> None:
    response = await client.get("/api/v1/garmin/ingest-log")
    assert response.status_code == 200
    data = response.json()
    assert data["entries"] == []
    assert data["count"] == 0


@pytest.mark.unit
async def test_get_ingest_log_returns_entries(client: AsyncClient, db_session: Session) -> None:
    for outcome in ("success", "partial", "skipped"):
        db_session.add(GarminIngestLog(
            run_at=datetime.now(UTC),
            target_date=date(2026, 1, 1),
            outcome=outcome,
            retry_count=0,
        ))
    db_session.commit()

    response = await client.get("/api/v1/garmin/ingest-log")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 3
    outcomes = [e["outcome"] for e in data["entries"]]
    assert "success" in outcomes
    assert "partial" in outcomes
    assert "skipped" in outcomes


@pytest.mark.unit
async def test_get_ingest_log_limit(client: AsyncClient, db_session: Session) -> None:
    for i in range(10):
        db_session.add(GarminIngestLog(
            run_at=datetime.now(UTC),
            target_date=date(2026, 1, i + 1),
            outcome="success",
            retry_count=0,
        ))
    db_session.commit()

    response = await client.get("/api/v1/garmin/ingest-log?limit=3")
    assert response.status_code == 200
    assert response.json()["count"] == 3
