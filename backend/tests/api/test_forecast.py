"""Integration tests for GET /api/v1/forecast."""
from datetime import UTC, datetime, timedelta

import pytest

from app.models.glucose import GlucoseReading


def _add_readings(db_session, count: int, glucose: int = 120, interval_min: int = 5):
    base = datetime.now(UTC) - timedelta(minutes=count * interval_min)
    for i in range(count):
        db_session.add(
            GlucoseReading(
                timestamp=base + timedelta(minutes=i * interval_min),
                glucose_mg_dl=glucose + (i % 10),
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()


@pytest.mark.asyncio
async def test_forecast_no_models(client, tmp_path, monkeypatch):
    """When no joblib files exist, model_trained=False and forecasts=[]."""
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    resp = await client.get("/api/v1/forecast")
    assert resp.status_code == 200
    data = resp.json()
    assert data["model_trained"] is False
    assert data["forecasts"] == []
    assert data["overall_risk"] == "unknown"


@pytest.mark.asyncio
async def test_forecast_insufficient_data(client, db_session, tmp_path, monkeypatch):
    """Fewer than 288 readings → train_models returns False → model_trained=False."""
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session, count=50)

    from app.services.forecasting import train_models
    assert train_models(db_session) is False

    resp = await client.get("/api/v1/forecast")
    assert resp.status_code == 200
    assert resp.json()["model_trained"] is False


@pytest.mark.asyncio
async def test_forecast_with_trained_models(client, db_session, tmp_path, monkeypatch):
    """With ≥288 readings and trained models, returns 3 horizon forecasts."""
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session, count=400)

    from app.services.forecasting import train_models
    assert train_models(db_session) is True

    resp = await client.get("/api/v1/forecast")
    assert resp.status_code == 200
    data = resp.json()
    assert data["model_trained"] is True
    assert len(data["forecasts"]) == 3
    assert {f["horizon_min"] for f in data["forecasts"]} == {30, 60, 120}
    for f in data["forecasts"]:
        assert f["predicted_mg_dl"] > 0
        assert f["ci_lower"] <= f["predicted_mg_dl"] <= f["ci_upper"]
        assert 0.0 <= f["p_hypo"] <= 1.0
        assert 0.0 <= f["p_hyper"] <= 1.0
        assert f["risk_level"] in {"low", "moderate", "high", "critical"}
    assert data["overall_risk"] in {"low", "moderate", "high", "critical"}


@pytest.mark.asyncio
async def test_forecast_meta_populated(client, db_session, tmp_path, monkeypatch):
    """After training, meta fields are populated."""
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session, count=400)

    from app.services.forecasting import train_models
    train_models(db_session)

    resp = await client.get("/api/v1/forecast")
    meta = resp.json()["meta"]
    assert meta["last_trained"] is not None
    assert meta["training_samples"] == 400
    assert set(meta["mae_per_horizon"].keys()) == {"h30", "h60", "h120"}


@pytest.mark.asyncio
async def test_forecast_ci_bounds_ordered(client, db_session, tmp_path, monkeypatch):
    """ci_lower ≤ predicted ≤ ci_upper for all horizons."""
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session, count=400)
    from app.services.forecasting import train_models
    train_models(db_session)

    resp = await client.get("/api/v1/forecast")
    for f in resp.json()["forecasts"]:
        assert f["ci_lower"] <= f["predicted_mg_dl"] <= f["ci_upper"]
