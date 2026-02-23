import pytest
from httpx import AsyncClient

HEALTH_PAYLOAD = {
    "timestamp": "2026-02-23T08:00:00Z",
    "heart_rate_bpm": 72,
    "weight_kg": 75.5,
    "activity_type": "walking",
    "activity_minutes": 30,
    "notes": "morning",
}


@pytest.mark.unit
async def test_post_health_metric(client: AsyncClient) -> None:
    response = await client.post("/api/v1/health", json=HEALTH_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["heart_rate_bpm"] == 72
    assert data["weight_kg"] == 75.5
    assert data["activity_type"] == "walking"
    assert "id" in data


@pytest.mark.unit
async def test_post_health_metric_minimal(client: AsyncClient) -> None:
    payload = {"timestamp": "2026-02-23T09:00:00Z"}
    response = await client.post("/api/v1/health", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["heart_rate_bpm"] is None
    assert data["weight_kg"] is None


@pytest.mark.unit
async def test_post_health_metric_invalid_hr(client: AsyncClient) -> None:
    bad = {**HEALTH_PAYLOAD, "heart_rate_bpm": 10}
    response = await client.post("/api/v1/health", json=bad)
    assert response.status_code == 422
