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


def _add_overnight_readings(db_session, nights: int, hour_utc: int, glucose: int = 100):
    """Add one reading per night at the given UTC hour, across `nights` consecutive nights."""
    base = datetime.now(UTC).replace(hour=hour_utc, minute=0, second=0, microsecond=0)
    for i in range(nights):
        db_session.add(
            GlucoseReading(
                timestamp=base - timedelta(days=i),
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
    assert len(data["patterns"]) == 9
    for p in data["patterns"]:
        assert p["detected"] is False
        assert isinstance(p["name"], str)
        assert isinstance(p["description"], str)


@pytest.mark.asyncio
async def test_pattern_history_endpoint_empty(client):
    resp = await client.get("/api/v1/analytics/patterns/history")
    assert resp.status_code == 200
    assert resp.json() == {"history": []}


@pytest.mark.asyncio
async def test_stats_window_days_present(client):
    resp = await client.get("/api/v1/analytics/stats")
    windows = resp.json()["windows"]
    assert {w["window_days"] for w in windows} == {30, 60, 90}


# ─── /analytics/recommendations ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_recommendations_empty_no_data(client):
    """With no data, no patterns are detected → no recommendations returned."""
    resp = await client.get("/api/v1/analytics/recommendations")
    assert resp.status_code == 200
    data = resp.json()
    assert data["recommendations"] == []
    assert data["patterns_analyzed"] == 9
    assert data["detected_count"] == 0


@pytest.mark.asyncio
async def test_recommendations_response_shape(client):
    resp = await client.get("/api/v1/analytics/recommendations")
    assert resp.status_code == 200
    data = resp.json()
    assert "recommendations" in data
    assert "patterns_analyzed" in data
    assert "detected_count" in data


@pytest.mark.asyncio
async def test_recommendations_unit_generate_single():
    """Unit-test the engine directly — single detected pattern produces one recommendation."""
    from app.schemas.analytics import PatternItem
    from app.services.recommendations import generate_recommendations

    patterns = [
        PatternItem(
            name="Basal Rate Misalignment",
            detected=True,
            description="rising",
            confidence=0.8,
        ),
        PatternItem(name="Dawn Phenomenon", detected=False, description="ok", confidence=None),
    ]
    result = generate_recommendations(patterns)
    assert result.detected_count == 1
    assert len(result.recommendations) == 1
    rec = result.recommendations[0]
    assert rec.priority == "high"
    assert "Basal Rate Misalignment" in rec.linked_patterns


@pytest.mark.asyncio
async def test_recommendations_unit_combo_rule():
    """Dawn + Basal Misalignment triggers the combo rule, not two separate ones."""
    from app.schemas.analytics import PatternItem
    from app.services.recommendations import generate_recommendations

    patterns = [
        PatternItem(
            name="Dawn Phenomenon", detected=True, description="detected", confidence=0.9
        ),
        PatternItem(
            name="Basal Rate Misalignment", detected=True, description="detected", confidence=0.8
        ),
    ]
    result = generate_recommendations(patterns)
    assert result.detected_count == 2
    # Combo rule fires → single recommendation consuming both patterns
    assert len(result.recommendations) == 1
    rec = result.recommendations[0]
    assert set(rec.linked_patterns) == {"Dawn Phenomenon", "Basal Rate Misalignment"}
    assert rec.priority == "high"


@pytest.mark.asyncio
async def test_recommendations_unit_priority_ordering():
    """Recommendations are ordered high → medium → low."""
    from app.schemas.analytics import PatternItem
    from app.services.recommendations import generate_recommendations

    patterns = [
        PatternItem(
            name="Exercise Sensitivity", detected=True, description="d", confidence=0.7
        ),
        PatternItem(
            name="Basal Rate Misalignment", detected=True, description="d", confidence=0.9
        ),
    ]
    result = generate_recommendations(patterns)
    priorities = [r.priority for r in result.recommendations]
    assert priorities == sorted(
        priorities, key=lambda p: {"high": 0, "medium": 1, "low": 2}[p]
    )


# ─── /analytics/basal-windows ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_basal_windows_empty(client):
    resp = await client.get("/api/v1/analytics/basal-windows")
    assert resp.status_code == 200
    data = resp.json()
    assert "blocks" in data
    assert len(data["blocks"]) == 5
    assert data["nights_analyzed"] == 0
    assert data["tz"] == "UTC"
    for b in data["blocks"]:
        assert b["median"] is None
        assert b["nights"] == 0


@pytest.mark.asyncio
async def test_basal_windows_invalid_tz(client):
    resp = await client.get("/api/v1/analytics/basal-windows?tz=Invalid/Zone")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_basal_windows_insufficient_nights(client, db_session):
    # Only 2 nights → below MIN_NIGHTS threshold of 3
    _add_overnight_readings(db_session, nights=2, hour_utc=2, glucose=100)
    resp = await client.get("/api/v1/analytics/basal-windows")
    assert resp.status_code == 200
    blocks = resp.json()["blocks"]
    # 02:00–04:00 block should have n=2 but median=None
    block = next(b for b in blocks if b["block_label"] == "02:00–04:00")
    assert block["median"] is None
    assert block["nights"] == 2


@pytest.mark.asyncio
async def test_basal_windows_with_data(client, db_session):
    # Add 5 nights of readings in 02:00–04:00 block (UTC hour 3)
    _add_overnight_readings(db_session, nights=5, hour_utc=3, glucose=110)
    resp = await client.get("/api/v1/analytics/basal-windows")
    assert resp.status_code == 200
    data = resp.json()
    assert data["nights_analyzed"] == 5
    block = next(b for b in data["blocks"] if b["block_label"] == "02:00–04:00")
    assert block["median"] == pytest.approx(110.0)
    assert block["p25"] == pytest.approx(110.0)
    assert block["p75"] == pytest.approx(110.0)
    assert block["n"] == 5
    assert block["nights"] == 5


@pytest.mark.asyncio
async def test_basal_windows_block_labels_present(client):
    resp = await client.get("/api/v1/analytics/basal-windows")
    labels = {b["block_label"] for b in resp.json()["blocks"]}
    assert labels == {"22:00–00:00", "00:00–02:00", "02:00–04:00", "04:00–06:00", "06:00–08:00"}
