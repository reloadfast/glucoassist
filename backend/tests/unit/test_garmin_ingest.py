from datetime import UTC, date, datetime
from unittest.mock import MagicMock, patch

import pytest

from app.core.config import Settings
from app.models.health import HealthMetric
from app.services.garmin_ingest import (
    _already_ingested,
    _parse_rhr,
    _parse_sleep,
    _parse_stress,
    _parse_weight,
    run_garmin_ingest,
)


# ─── Pure parser tests ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_parse_rhr_present() -> None:
    assert _parse_rhr({"restingHeartRate": 58}) == 58


@pytest.mark.unit
def test_parse_rhr_missing() -> None:
    assert _parse_rhr({}) is None


@pytest.mark.unit
def test_parse_weight_grams_to_kg() -> None:
    body = {"totalAverage": {"weight": 75000}}
    assert _parse_weight(body) == 75.0


@pytest.mark.unit
def test_parse_weight_none_input() -> None:
    assert _parse_weight(None) is None


@pytest.mark.unit
def test_parse_sleep_seconds_to_hours() -> None:
    sleep = {"dailySleepDTO": {"sleepTimeSeconds": 25200}}
    assert _parse_sleep(sleep) == 7.0


@pytest.mark.unit
def test_parse_sleep_none_input() -> None:
    assert _parse_sleep(None) is None


@pytest.mark.unit
def test_parse_stress_avg() -> None:
    assert _parse_stress({"avgStressLevel": 42}) == 42


@pytest.mark.unit
def test_parse_stress_overall_fallback() -> None:
    assert _parse_stress({"overallStressLevel": 35}) == 35


@pytest.mark.unit
def test_parse_stress_none() -> None:
    assert _parse_stress(None) is None


# ─── _already_ingested ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_already_ingested_false_when_empty(db_session) -> None:
    assert not _already_ingested(db_session, date(2026, 2, 23))


@pytest.mark.unit
def test_already_ingested_true_when_row_exists(db_session) -> None:
    metric = HealthMetric(
        timestamp=datetime(2026, 2, 23, 0, 0, 0),
        source="garmin",
    )
    db_session.add(metric)
    db_session.commit()
    assert _already_ingested(db_session, date(2026, 2, 23))


@pytest.mark.unit
def test_already_ingested_ignores_non_garmin_source(db_session) -> None:
    metric = HealthMetric(
        timestamp=datetime(2026, 2, 23, 0, 0, 0),
        source="manual",
    )
    db_session.add(metric)
    db_session.commit()
    assert not _already_ingested(db_session, date(2026, 2, 23))


# ─── run_garmin_ingest ────────────────────────────────────────────────────────


def _garmin_settings(**overrides) -> Settings:
    base = {
        "garmin_enabled": True,
        "garmin_username": "user@example.com",
        "garmin_password": "secret",  # noqa: S106
        "garmin_ingest_interval_seconds": 3600,
    }
    base.update(overrides)
    return Settings(**base)


@pytest.mark.unit
def test_run_garmin_ingest_disabled(db_session) -> None:
    settings = _garmin_settings(garmin_enabled=False)
    assert run_garmin_ingest(db_session, settings) == 0


@pytest.mark.unit
def test_run_garmin_ingest_no_credentials(db_session) -> None:
    settings = _garmin_settings(garmin_username="", garmin_password="")
    assert run_garmin_ingest(db_session, settings) == 0


@pytest.mark.unit
def test_run_garmin_ingest_skips_duplicate(db_session) -> None:
    today = datetime.now(UTC).date()
    metric = HealthMetric(
        timestamp=datetime(today.year, today.month, today.day, 0, 0, 0),
        source="garmin",
    )
    db_session.add(metric)
    db_session.commit()
    settings = _garmin_settings()
    assert run_garmin_ingest(db_session, settings) == 0


def _make_garmin_mock(mock_client: MagicMock) -> MagicMock:
    """Build a fake garminconnect module with sentinel exception classes."""

    class FakeRateLimit(Exception):
        pass

    class FakeAuthError(Exception):
        pass

    class FakeConnError(Exception):
        pass

    mod = MagicMock()
    mod.Garmin = MagicMock(return_value=mock_client)
    mod.GarminConnectTooManyRequestsError = FakeRateLimit
    mod.GarminConnectAuthenticationError = FakeAuthError
    mod.GarminConnectConnectionError = FakeConnError
    return mod


@pytest.mark.unit
def test_run_garmin_ingest_inserts_row(db_session) -> None:
    mock_client = MagicMock()
    mock_client.get_stats.return_value = {"restingHeartRate": 58}
    mock_client.get_body_composition.return_value = {"totalAverage": {"weight": 75000}}
    mock_client.get_sleep_data.return_value = {"dailySleepDTO": {"sleepTimeSeconds": 25200}}
    mock_client.get_stress_data.return_value = {"avgStressLevel": 30}

    mock_mod = _make_garmin_mock(mock_client)
    with patch.dict("sys.modules", {"garminconnect": mock_mod}):
        result = run_garmin_ingest(db_session, _garmin_settings())

    assert result == 1
    row = db_session.query(HealthMetric).filter_by(source="garmin").first()
    assert row is not None
    assert row.heart_rate_bpm == 58
    assert row.weight_kg == 75.0
    assert row.sleep_hours == 7.0
    assert row.stress_level == 30


@pytest.mark.unit
def test_run_garmin_ingest_auth_error(db_session) -> None:
    mock_client = MagicMock()
    mock_mod = _make_garmin_mock(mock_client)
    mock_client.login.side_effect = mock_mod.GarminConnectAuthenticationError("bad credentials")

    with patch.dict("sys.modules", {"garminconnect": mock_mod}):
        result = run_garmin_ingest(db_session, _garmin_settings())

    assert result == 0
    assert db_session.query(HealthMetric).count() == 0
