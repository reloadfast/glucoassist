from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from app.services.ingest import parse_entry, run_ingest

NOW_MS = int(datetime(2026, 2, 23, 12, 0, 0, tzinfo=UTC).timestamp() * 1000)

SGV_FLAT = {
    "type": "sgv",
    "sgv": 120,
    "date": NOW_MS,
    "direction": "Flat",
    "device": "libre-sensor",
}
SGV_SINGLE_UP = {
    "type": "sgv",
    "sgv": 140,
    "date": NOW_MS + 300000,
    "direction": "SingleUp",
    "device": "device-x",
}
SGV_DOUBLE_DOWN = {
    "type": "sgv",
    "sgv": 65,
    "date": NOW_MS + 600000,
    "direction": "DoubleDown",
    "device": None,
}
NON_SGV = {"type": "mbg", "mbg": 110, "date": NOW_MS}
NO_SGV_VALUE = {"type": "sgv", "date": NOW_MS}


@pytest.mark.unit
def test_parse_entry_flat():
    reading = parse_entry(SGV_FLAT)
    assert reading is not None
    assert reading.glucose_mg_dl == 120
    assert reading.trend_arrow == "Flat"
    assert "libre" in reading.source


@pytest.mark.unit
def test_parse_entry_single_up():
    reading = parse_entry(SGV_SINGLE_UP)
    assert reading is not None
    assert reading.glucose_mg_dl == 140
    assert reading.trend_arrow == "SingleUp"


@pytest.mark.unit
def test_parse_entry_double_down():
    reading = parse_entry(SGV_DOUBLE_DOWN)
    assert reading is not None
    assert reading.glucose_mg_dl == 65
    assert reading.trend_arrow == "DoubleDown"
    assert reading.device_id is None


@pytest.mark.unit
def test_parse_entry_non_sgv_skipped():
    result = parse_entry(NON_SGV)
    assert result is None


@pytest.mark.unit
def test_parse_entry_missing_sgv_value():
    result = parse_entry(NO_SGV_VALUE)
    assert result is None


@pytest.mark.unit
def test_parse_entry_missing_date():
    result = parse_entry({"type": "sgv", "sgv": 100})
    assert result is None


@pytest.mark.unit
def test_push_entries_inserts(db_session):
    from app.services.ingest import push_entries

    entries = [SGV_FLAT, NON_SGV]
    count = push_entries(db_session, entries)
    assert count == 1  # NON_SGV filtered out


@pytest.mark.unit
def test_push_entries_deduplicates(db_session):
    from app.services.ingest import push_entries

    count1 = push_entries(db_session, [SGV_FLAT])
    count2 = push_entries(db_session, [SGV_FLAT])
    assert count1 == 1
    assert count2 == 0


@pytest.mark.unit
def test_run_ingest_librelink_push_noop(db_session):
    from app.core.config import Settings

    settings = Settings(cgm_source="librelink_push")
    count = run_ingest(db_session, settings)
    assert count == 0


@pytest.mark.unit
def test_run_backfill_librelink_push_noop(db_session):
    from app.core.config import Settings
    from app.services.ingest import run_backfill

    settings = Settings(cgm_source="librelink_push")
    count = run_backfill(db_session, settings, days=7)
    assert count == 0


@pytest.mark.unit
def test_run_ingest_no_url(db_session):
    from app.core.config import Settings

    settings = Settings(cgm_source="librelink", librelink_url="")
    count = run_ingest(db_session, settings)
    assert count == 0


@pytest.mark.unit
def test_run_ingest_http_error(db_session):
    import httpx

    from app.core.config import Settings

    settings = Settings(cgm_source="nightscout", nightscout_url="http://fake.local")
    with patch("app.services.ingest.fetch_entries", side_effect=httpx.ConnectError("fail")):
        count = run_ingest(db_session, settings)
    assert count == 0


@pytest.mark.unit
def test_run_ingest_inserts_new(db_session):
    from app.core.config import Settings

    settings = Settings(cgm_source="librelink", librelink_url="http://fake.local")
    entries = [SGV_FLAT, SGV_SINGLE_UP]
    with patch("app.services.ingest.fetch_entries", return_value=entries):
        count = run_ingest(db_session, settings)
    assert count == 2


@pytest.mark.unit
def test_run_ingest_deduplicates(db_session):
    from app.core.config import Settings

    settings = Settings(cgm_source="librelink", librelink_url="http://fake.local")
    entries = [SGV_FLAT, SGV_SINGLE_UP]
    with patch("app.services.ingest.fetch_entries", return_value=entries):
        first = run_ingest(db_session, settings)
        second = run_ingest(db_session, settings)
    assert first == 2
    assert second == 0
