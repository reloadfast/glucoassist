"""Integration tests for /api/v1/analytics/* routes."""
from datetime import UTC, datetime, timedelta

import pytest

from app.models.glucose import GlucoseReading


def _add_readings(db_session, count: int, glucose: int = 110, days_ago: int = 0):
    base = datetime.now(UTC) - timedelta(days=days_ago)
    for i in range(count):
        db_session.add(
            GlucoseReading(
                timestamp=base - timedelta(hours=i * 5),
                glucose_mg_dl=glucose,
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()


@pytest.mark.asyncio
async def test_stats_empty(client):
    resp = await client.get("/api/v1/analytics/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "windows" in data
    assert len(data["windows"]) == 3  # 30, 60, 90 days
    for w in data["windows"]:
        assert w["reading_count"] == 0
        assert w["avg_glucose"] is None


@pytest.mark.asyncio
async def test_stats_with_data(client, db_session):
    _add_readings(db_session, 20, glucose=120)
    resp = await client.get("/api/v1/analytics/stats")
    assert resp.status_code == 200
    windows = resp.json()["windows"]
    # 30-day window should have data
    w30 = next(w for w in windows if w["window_days"] == 30)
    assert w30["reading_count"] == 20
    assert w30["avg_glucose"] == 120.0
    assert w30["tir_pct"] == 100.0
    assert w30["hba1c"] is not None


@pytest.mark.asyncio
async def test_hba1c_empty(client):
    resp = await client.get("/api/v1/analytics/hba1c")
    assert resp.status_code == 200
    data = resp.json()
    assert data["hba1c_30d"] is None
    assert data["eag_30d"] is None


@pytest.mark.asyncio
async def test_hba1c_with_data(client, db_session):
    _add_readings(db_session, 10, glucose=154)
    resp = await client.get("/api/v1/analytics/hba1c")
    assert resp.status_code == 200
    data = resp.json()
    assert data["eag_30d"] == pytest.approx(154.0)
    assert data["hba1c_30d"] == pytest.approx(7.0, abs=0.1)


@pytest.mark.asyncio
async def test_patterns_empty(client):
    resp = await client.get("/api/v1/analytics/patterns")
    assert resp.status_code == 200
    data = resp.json()
    assert "patterns" in data
    assert len(data["patterns"]) == 4
    for p in data["patterns"]:
        assert p["detected"] is False
        assert isinstance(p["name"], str)
        assert isinstance(p["description"], str)


@pytest.mark.asyncio
async def test_stats_window_days_present(client):
    resp = await client.get("/api/v1/analytics/stats")
    windows = resp.json()["windows"]
    assert {w["window_days"] for w in windows} == {30, 60, 90}
