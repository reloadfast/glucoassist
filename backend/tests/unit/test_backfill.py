"""Unit tests for historical backfill logic."""
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.services.ingest import run_backfill


@pytest.mark.unit
def test_run_backfill_no_url(db_session):
    settings = MagicMock()
    settings.cgm_source = "nightscout"
    settings.nightscout_url = ""
    settings.nightscout_token = ""

    result = run_backfill(db_session, settings, days=30)
    assert result == 0


@pytest.mark.unit
def test_run_backfill_librelink_no_url(db_session):
    settings = MagicMock()
    settings.cgm_source = "librelink"
    settings.librelink_url = ""

    result = run_backfill(db_session, settings, days=30)
    assert result == 0


@pytest.mark.unit
def test_run_backfill_empty_response(db_session):
    settings = MagicMock()
    settings.cgm_source = "nightscout"
    settings.nightscout_url = "http://ns.local"
    settings.nightscout_token = ""

    with patch("app.services.ingest.fetch_entries_page", return_value=[]):
        result = run_backfill(db_session, settings, days=30)

    assert result == 0


@pytest.mark.unit
def test_run_backfill_inserts_readings(db_session):
    settings = MagicMock()
    settings.cgm_source = "nightscout"
    settings.nightscout_url = "http://ns.local"
    settings.nightscout_token = ""

    now = datetime.now(UTC)
    fake_entries = [
        {
            "type": "sgv",
            "sgv": 120 + i,
            "date": int((now - timedelta(minutes=i * 5)).timestamp() * 1000),
            "direction": "Flat",
            "device": "nightscout",
        }
        for i in range(5)
    ]

    # Return entries on first call, empty on second (stops pagination)
    with patch("app.services.ingest.fetch_entries_page", side_effect=[fake_entries, []]):
        result = run_backfill(db_session, settings, days=1)

    assert result == 5


@pytest.mark.unit
def test_run_backfill_skips_duplicates(db_session):
    settings = MagicMock()
    settings.cgm_source = "nightscout"
    settings.nightscout_url = "http://ns.local"
    settings.nightscout_token = ""

    now = datetime.now(UTC)
    fake_entries = [
        {
            "type": "sgv",
            "sgv": 110,
            "date": int((now - timedelta(minutes=5)).timestamp() * 1000),
            "direction": "Flat",
            "device": "nightscout",
        }
    ]

    with patch("app.services.ingest.fetch_entries_page", side_effect=[fake_entries, []]):
        first = run_backfill(db_session, settings, days=1)

    with patch("app.services.ingest.fetch_entries_page", side_effect=[fake_entries, []]):
        second = run_backfill(db_session, settings, days=1)

    assert first == 1
    assert second == 0  # duplicate skipped


@pytest.mark.unit
def test_run_backfill_http_error(db_session):
    import httpx

    settings = MagicMock()
    settings.cgm_source = "nightscout"
    settings.nightscout_url = "http://ns.local"
    settings.nightscout_token = ""

    with patch(
        "app.services.ingest.fetch_entries_page",
        side_effect=httpx.ConnectError("refused"),
    ):
        result = run_backfill(db_session, settings, days=30)

    assert result == 0


@pytest.mark.asyncio
async def test_backfill_api_endpoint(client):
    """POST /api/v1/ingest/backfill should return immediately even with no data."""
    with patch("app.services.ingest.fetch_entries_page", return_value=[]):
        with patch("app.api.v1.ingest.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                cgm_source="nightscout",
                nightscout_url="http://ns.local",
                nightscout_token="",
            )
            resp = await client.post("/api/v1/ingest/backfill?days=7")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["days"] == 7
    assert data["inserted"] == 0
