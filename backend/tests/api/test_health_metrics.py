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


@pytest.mark.unit
async def test_get_health_empty(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["entries"] == []
    assert data["count"] == 0


@pytest.mark.unit
async def test_get_health_with_data(client: AsyncClient) -> None:
    await client.post("/api/v1/health", json=HEALTH_PAYLOAD)
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 1
    assert data["entries"][0]["heart_rate_bpm"] == 72


@pytest.mark.unit
async def test_get_health_filters(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/health",
        params={"from": "2030-01-01T00:00:00Z", "to": "2030-12-31T00:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.unit
async def test_delete_health(client: AsyncClient) -> None:
    create = await client.post("/api/v1/health", json=HEALTH_PAYLOAD)
    metric_id = create.json()["id"]
    response = await client.delete(f"/api/v1/health/{metric_id}")
    assert response.status_code == 204
    list_resp = await client.get("/api/v1/health")
    ids = [e["id"] for e in list_resp.json()["entries"]]
    assert metric_id not in ids


@pytest.mark.unit
async def test_delete_health_not_found(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/health/999999")
    assert response.status_code == 404
