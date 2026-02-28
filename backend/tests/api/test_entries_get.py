"""Tests for GET /api/v1/entries and API-SECRET auth on /api/v1/entries."""

from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.config import Settings

# ── helpers ───────────────────────────────────────────────────────────────────

BASE_MS = int(datetime(2026, 1, 15, 10, 0, 0, tzinfo=UTC).timestamp() * 1000)

_SETTINGS_WITH_SECRET = Settings(app_secret_key="test", push_secret="correct-secret")
_SETTINGS_NO_SECRET = Settings(app_secret_key="test", push_secret="")


async def _seed(client: AsyncClient, n: int = 3) -> None:
    entries = [
        {
            "type": "sgv",
            "sgv": 100 + i * 5,
            "date": BASE_MS + i * 300_000,
            "direction": "Flat",
            "device": "test-sensor",
        }
        for i in range(n)
    ]
    resp = await client.post("/api/v1/entries", json=entries)
    assert resp.status_code == 200


# ── GET /api/v1/entries — basic ───────────────────────────────────────────────


@pytest.mark.unit
async def test_get_entries_empty_db(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/entries")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.unit
async def test_get_entries_returns_newest_first(client: AsyncClient) -> None:
    await _seed(client, 3)
    rows = (await client.get("/api/v1/entries")).json()
    assert len(rows) == 3
    assert rows[0]["date"] > rows[1]["date"] > rows[2]["date"]


@pytest.mark.unit
async def test_get_entries_count_param(client: AsyncClient) -> None:
    await _seed(client, 5)
    rows = (await client.get("/api/v1/entries", params={"count": 2})).json()
    assert len(rows) == 2


@pytest.mark.unit
async def test_get_entries_response_shape(client: AsyncClient) -> None:
    await _seed(client, 1)
    row = (await client.get("/api/v1/entries")).json()[0]
    for field in ("_id", "type", "sgv", "date", "dateString", "trend", "direction", "device"):
        assert field in row
    assert row["type"] == "sgv"
    assert isinstance(row["sgv"], int)
    assert isinstance(row["date"], int)
    assert isinstance(row["trend"], int)


@pytest.mark.unit
async def test_get_entries_filter_gte(client: AsyncClient) -> None:
    await _seed(client, 3)
    cutoff = BASE_MS + 300_000  # second oldest
    rows = (await client.get("/api/v1/entries", params={"find[date][$gte]": cutoff})).json()
    assert len(rows) == 2
    assert all(r["date"] >= cutoff for r in rows)


@pytest.mark.unit
async def test_get_entries_filter_lte(client: AsyncClient) -> None:
    await _seed(client, 3)
    cutoff = BASE_MS + 300_000  # second oldest
    rows = (await client.get("/api/v1/entries", params={"find[date][$lte]": cutoff})).json()
    assert len(rows) == 2
    assert all(r["date"] <= cutoff for r in rows)


@pytest.mark.unit
async def test_get_entries_filter_range(client: AsyncClient) -> None:
    await _seed(client, 5)
    lo, hi = BASE_MS + 300_000, BASE_MS + 600_000
    rows = (
        await client.get(
            "/api/v1/entries",
            params={"find[date][$gte]": lo, "find[date][$lte]": hi},
        )
    ).json()
    assert len(rows) == 2
    assert all(lo <= r["date"] <= hi for r in rows)


# ── API-SECRET auth ────────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_no_secret_open_get(client: AsyncClient) -> None:
    """When PUSH_SECRET is unset, GET succeeds without a header."""
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_NO_SECRET):
        resp = await client.get("/api/v1/entries")
    assert resp.status_code == 200


@pytest.mark.unit
async def test_no_secret_open_post(client: AsyncClient) -> None:
    """When PUSH_SECRET is unset, POST succeeds without a header."""
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_NO_SECRET):
        resp = await client.post("/api/v1/entries", json=[])
    assert resp.status_code == 200


@pytest.mark.unit
async def test_correct_secret_get(client: AsyncClient) -> None:
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_WITH_SECRET):
        resp = await client.get("/api/v1/entries", headers={"API-SECRET": "correct-secret"})
    assert resp.status_code == 200


@pytest.mark.unit
async def test_correct_secret_post(client: AsyncClient) -> None:
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_WITH_SECRET):
        resp = await client.post(
            "/api/v1/entries", json=[], headers={"API-SECRET": "correct-secret"}
        )
    assert resp.status_code == 200


@pytest.mark.unit
async def test_wrong_secret_get(client: AsyncClient) -> None:
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_WITH_SECRET):
        resp = await client.get("/api/v1/entries", headers={"API-SECRET": "wrong"})
    assert resp.status_code == 401


@pytest.mark.unit
async def test_wrong_secret_post(client: AsyncClient) -> None:
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_WITH_SECRET):
        resp = await client.post(
            "/api/v1/entries", json=[], headers={"API-SECRET": "wrong"}
        )
    assert resp.status_code == 401


@pytest.mark.unit
async def test_missing_header_get(client: AsyncClient) -> None:
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_WITH_SECRET):
        resp = await client.get("/api/v1/entries")
    assert resp.status_code == 401


@pytest.mark.unit
async def test_missing_header_post(client: AsyncClient) -> None:
    with patch("app.api.v1.entries.get_settings", return_value=_SETTINGS_WITH_SECRET):
        resp = await client.post("/api/v1/entries", json=[])
    assert resp.status_code == 401
