"""Unit tests for the direct LibreLink/LibreView API client."""

import json
import time
from datetime import datetime
from unittest.mock import MagicMock, mock_open, patch

import httpx
import pytest

from app.core.config import Settings
from app.services.librelink_direct import (
    LLUClient,
    _is_token_valid,
    _load_token_cache,
    _parse_llu_timestamp,
    _save_token_cache,
    run_librelink_direct_ingest,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────

VALID_SETTINGS = Settings(
    cgm_source="librelink_direct",
    librelink_email="user@example.com",
    librelink_password="secret",  # noqa: S106
    librelink_region="EU",
    librelink_tokenstore="",  # disable disk I/O in tests
)

GRAPH_RESPONSE = {
    "status": 0,
    "data": {
        "connection": {
            "patientId": "conn-123",
            "glucoseMeasurement": {
                "FactoryTimestamp": "2/24/2026 10:00:00 AM",
                "ValueInMgPerDl": 120,
                "TrendArrow": 4,  # Flat
            },
        },
        "graphData": [
            {
                "FactoryTimestamp": "2/24/2026 9:55:00 AM",
                "ValueInMgPerDl": 115,
            },
            {
                "FactoryTimestamp": "2/24/2026 9:50:00 AM",
                "ValueInMgPerDl": 110,
            },
        ],
    },
}

LOGIN_RESPONSE = {
    "status": 0,
    "data": {
        "authTicket": {
            "token": "test-token",
            "expires": int(time.time()) + 3600,
            "duration": 15552000,
        },
        "user": {"id": "user-abc"},
    },
}

CONNECTIONS_RESPONSE = {
    "status": 0,
    "data": [{"patientId": "conn-123"}],
}

# ── Timestamp parsing ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_parse_llu_timestamp_zero_padded():
    dt = _parse_llu_timestamp("02/24/2026 10:00:00 AM")
    assert dt == datetime(2026, 2, 24, 10, 0, 0)


@pytest.mark.unit
def test_parse_llu_timestamp_unpadded():
    dt = _parse_llu_timestamp("2/4/2026 9:05:00 AM")
    assert dt == datetime(2026, 2, 4, 9, 5, 0)


@pytest.mark.unit
def test_parse_llu_timestamp_pm():
    dt = _parse_llu_timestamp("12/31/2025 11:55:00 PM")
    assert dt == datetime(2025, 12, 31, 23, 55, 0)


@pytest.mark.unit
def test_parse_llu_timestamp_invalid():
    with pytest.raises(ValueError):
        _parse_llu_timestamp("not-a-date")


# ── Token cache ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_is_token_valid_future():
    cache = {"expires": int(time.time()) + 3600}
    assert _is_token_valid(cache) is True


@pytest.mark.unit
def test_is_token_valid_expired():
    cache = {"expires": int(time.time()) - 1}
    assert _is_token_valid(cache) is False


@pytest.mark.unit
def test_is_token_valid_missing_expires():
    assert _is_token_valid({}) is False


@pytest.mark.unit
def test_load_token_cache_missing_file(tmp_path):
    result = _load_token_cache(str(tmp_path / "nonexistent.json"))
    assert result is None


@pytest.mark.unit
def test_load_token_cache_valid(tmp_path):
    p = tmp_path / "tokens.json"
    p.write_text(json.dumps({"token": "t", "expires": 9999999999}))
    result = _load_token_cache(str(p))
    assert result is not None
    assert result["token"] == "t"


@pytest.mark.unit
def test_load_token_cache_corrupt(tmp_path):
    p = tmp_path / "tokens.json"
    p.write_text("not-json")
    result = _load_token_cache(str(p))
    assert result is None


@pytest.mark.unit
def test_save_token_cache(tmp_path):
    p = tmp_path / "tokens.json"
    _save_token_cache(str(p), {"token": "abc"})
    assert json.loads(p.read_text())["token"] == "abc"


# ── LLUClient — login ─────────────────────────────────────────────────────────


def _make_response(status_code: int, body: dict) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = body
    resp.raise_for_status.return_value = None
    return resp


@pytest.mark.unit
def test_login_success():
    client = LLUClient(VALID_SETTINGS)
    mock_resp = _make_response(200, LOGIN_RESPONSE)

    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http.__enter__ = MagicMock(return_value=mock_http)
        mock_http.__exit__ = MagicMock(return_value=False)
        mock_http.post.return_value = mock_resp
        mock_http_cls.return_value = mock_http

        result = client.login()

    assert result is True
    assert client._token == "test-token"


@pytest.mark.unit
def test_login_http_error():
    client = LLUClient(VALID_SETTINGS)

    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http.__enter__ = MagicMock(return_value=mock_http)
        mock_http.__exit__ = MagicMock(return_value=False)
        mock_http.post.side_effect = httpx.ConnectError("refused")
        mock_http_cls.return_value = mock_http

        result = client.login()

    assert result is False


@pytest.mark.unit
def test_login_api_error_status():
    client = LLUClient(VALID_SETTINGS)
    mock_resp = _make_response(200, {"status": 4, "error": {"message": "Invalid credentials"}})

    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http.__enter__ = MagicMock(return_value=mock_http)
        mock_http.__exit__ = MagicMock(return_value=False)
        mock_http.post.return_value = mock_resp
        mock_http_cls.return_value = mock_http

        result = client.login()

    assert result is False


# ── LLUClient — fetch_readings ────────────────────────────────────────────────


@pytest.mark.unit
def test_fetch_readings_success():
    """With a valid cached token and connection, readings are returned."""
    settings = Settings(
        cgm_source="librelink_direct",
        librelink_email="user@example.com",
        librelink_password="secret",  # noqa: S106
        librelink_region="EU",
        librelink_tokenstore="",
    )
    client = LLUClient(settings)
    client._token = "cached-token"
    client._account_id = "acct-hash"
    client._connection_id = "conn-123"

    mock_resp = _make_response(200, GRAPH_RESPONSE)

    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http.__enter__ = MagicMock(return_value=mock_http)
        mock_http.__exit__ = MagicMock(return_value=False)
        mock_http.get.return_value = mock_resp
        mock_http_cls.return_value = mock_http

        readings = client.fetch_readings()

    assert len(readings) == 3
    current = next(r for r in readings if r.trend_arrow == "Flat")
    assert current.glucose_mg_dl == 120
    assert current.source == "librelink_direct"


@pytest.mark.unit
def test_fetch_readings_no_token_triggers_login():
    """When token is absent, fetch_readings should call login first."""
    client = LLUClient(VALID_SETTINGS)
    assert client._token is None

    with patch.object(client, "login", return_value=False) as mock_login:
        readings = client.fetch_readings()

    mock_login.assert_called_once()
    assert readings == []


@pytest.mark.unit
def test_fetch_readings_http_error():
    client = LLUClient(VALID_SETTINGS)
    client._token = "tok"
    client._account_id = "acct"
    client._connection_id = "conn-1"

    with patch("httpx.Client") as mock_http_cls:
        mock_http = MagicMock()
        mock_http.__enter__ = MagicMock(return_value=mock_http)
        mock_http.__exit__ = MagicMock(return_value=False)
        mock_http.get.side_effect = httpx.ConnectError("refused")
        mock_http_cls.return_value = mock_http

        readings = client.fetch_readings()

    assert readings == []


# ── LLUClient — _parse_graph_response ────────────────────────────────────────


@pytest.mark.unit
def test_parse_graph_response_full():
    client = LLUClient(VALID_SETTINGS)
    readings = client._parse_graph_response(GRAPH_RESPONSE["data"])
    assert len(readings) == 3
    trend_readings = [r for r in readings if r.trend_arrow is not None]
    assert len(trend_readings) == 1
    assert trend_readings[0].trend_arrow == "Flat"


@pytest.mark.unit
def test_parse_graph_response_empty():
    client = LLUClient(VALID_SETTINGS)
    readings = client._parse_graph_response({})
    assert readings == []


@pytest.mark.unit
def test_parse_reading_missing_value():
    client = LLUClient(VALID_SETTINGS)
    result = client._parse_reading({"FactoryTimestamp": "2/24/2026 10:00:00 AM"})
    assert result is None


@pytest.mark.unit
def test_parse_reading_missing_timestamp():
    client = LLUClient(VALID_SETTINGS)
    result = client._parse_reading({"ValueInMgPerDl": 120})
    assert result is None


# ── run_librelink_direct_ingest ───────────────────────────────────────────────


@pytest.mark.unit
def test_run_librelink_direct_ingest_missing_credentials(db_session):
    settings = Settings(cgm_source="librelink_direct", librelink_email="", librelink_password="")
    count = run_librelink_direct_ingest(db_session, settings)
    assert count == 0


@pytest.mark.unit
def test_run_librelink_direct_ingest_no_readings(db_session):
    with patch(
        "app.services.librelink_direct.LLUClient.fetch_readings", return_value=[]
    ):
        count = run_librelink_direct_ingest(db_session, VALID_SETTINGS)
    assert count == 0


@pytest.mark.unit
def test_run_librelink_direct_ingest_inserts(db_session):
    from app.models.glucose import GlucoseReading

    fake_readings = [
        GlucoseReading(
            timestamp=datetime(2026, 2, 24, 10, 0, 0),
            glucose_mg_dl=120,
            trend_arrow="Flat",
            source="librelink_direct",
        ),
        GlucoseReading(
            timestamp=datetime(2026, 2, 24, 9, 55, 0),
            glucose_mg_dl=115,
            trend_arrow=None,
            source="librelink_direct",
        ),
    ]

    with patch(
        "app.services.librelink_direct.LLUClient.fetch_readings",
        return_value=fake_readings,
    ):
        count = run_librelink_direct_ingest(db_session, VALID_SETTINGS)

    assert count == 2


@pytest.mark.unit
def test_run_librelink_direct_ingest_deduplicates(db_session):
    from app.models.glucose import GlucoseReading

    fake_readings = [
        GlucoseReading(
            timestamp=datetime(2026, 2, 24, 10, 0, 0),
            glucose_mg_dl=120,
            trend_arrow="Flat",
            source="librelink_direct",
        ),
    ]

    with patch(
        "app.services.librelink_direct.LLUClient.fetch_readings",
        return_value=fake_readings,
    ):
        first = run_librelink_direct_ingest(db_session, VALID_SETTINGS)
        second = run_librelink_direct_ingest(db_session, VALID_SETTINGS)

    assert first == 1
    assert second == 0
