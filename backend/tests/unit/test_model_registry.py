"""Unit tests for model registry, A/B promotion, and TrainResult."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.glucose import GlucoseReading
from app.services.forecasting import (
    TrainResult,
    _append_registry,
    _load_registry,
    _should_promote,
    train_models,
)


def _add_readings(db_session, count: int = 400, glucose: int = 120):
    base = datetime.now(UTC) - timedelta(minutes=count * 5)
    for i in range(count):
        db_session.add(
            GlucoseReading(
                timestamp=base + timedelta(minutes=i * 5),
                glucose_mg_dl=glucose + (i % 10),
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()


# ── _should_promote ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_promote_when_no_current_model():
    assert _should_promote(None, {"h30": 10.0, "h60": 12.0, "h120": 15.0}) is True


@pytest.mark.unit
def test_promote_when_candidate_better():
    current = {"h30": 15.0, "h60": 18.0, "h120": 22.0}
    candidate = {"h30": 10.0, "h60": 12.0, "h120": 15.0}
    assert _should_promote(current, candidate) is True


@pytest.mark.unit
def test_no_promote_when_candidate_worse():
    current = {"h30": 8.0, "h60": 10.0, "h120": 12.0}
    candidate = {"h30": 15.0, "h60": 18.0, "h120": 22.0}
    assert _should_promote(current, candidate) is False


@pytest.mark.unit
def test_no_promote_when_equal():
    maes = {"h30": 10.0, "h60": 12.0, "h120": 15.0}
    assert _should_promote(maes, maes) is False


# ── Registry helpers ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_load_registry_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    assert _load_registry() == []


@pytest.mark.unit
def test_registry_append_and_read(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _append_registry({"version_id": "v1", "promoted": True})
    _append_registry({"version_id": "v2", "promoted": False})
    entries = _load_registry()
    assert len(entries) == 2
    assert entries[0]["version_id"] == "v1"


@pytest.mark.unit
def test_registry_truncates_at_50(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    for i in range(55):
        _append_registry({"version_id": str(i)})
    entries = _load_registry()
    assert len(entries) == 50
    # Should keep the last 50 (entries 5–54)
    assert entries[0]["version_id"] == "5"


# ── TrainResult ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_train_result_insufficient_data(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session, count=50)
    result = train_models(db_session)
    assert isinstance(result, TrainResult)
    assert result.success is False
    assert result.promoted is False
    assert result.maes == {}


@pytest.mark.unit
def test_train_result_first_training_always_promotes(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session)
    result = train_models(db_session)
    assert result.success is True
    assert result.promoted is True
    assert set(result.maes.keys()) == {"h30", "h60", "h90", "h120"}


@pytest.mark.unit
def test_train_result_appends_to_registry(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session)
    train_models(db_session)
    entries = _load_registry()
    assert len(entries) == 1
    assert entries[0]["promoted"] is True
    assert "mae_per_horizon" in entries[0]


@pytest.mark.unit
def test_second_train_not_promoted_when_same_data(db_session, tmp_path, monkeypatch):
    """Second training on identical data should not improve MAE → not promoted."""
    monkeypatch.setattr("app.services.forecasting._model_dir", lambda: tmp_path)
    _add_readings(db_session)
    first = train_models(db_session)
    assert first.promoted is True
    second = train_models(db_session)
    assert second.success is True
    # Same data → MAE is equal → not strictly better → not promoted
    assert second.promoted is False
