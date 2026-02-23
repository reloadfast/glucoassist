import pytest
from httpx import AsyncClient

GLUCOSE_PAYLOAD = {
    "timestamp": "2026-02-23T12:00:00Z",
    "glucose_mg_dl": 120,
    "trend_arrow": "Flat",
    "source": "manual",
}


@pytest.mark.unit
async def test_get_glucose_empty(client: AsyncClient) -> None:
    response = await client.get("/api/v1/glucose")
    assert response.status_code == 200
    data = response.json()
    assert data["readings"] == []
    assert data["count"] == 0


@pytest.mark.unit
async def test_post_glucose(client: AsyncClient) -> None:
    response = await client.post("/api/v1/glucose", json=GLUCOSE_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["glucose_mg_dl"] == 120
    assert data["trend_arrow"] == "Flat"
    assert data["source"] == "manual"
    assert "id" in data


@pytest.mark.unit
async def test_get_glucose_with_data(client: AsyncClient) -> None:
    await client.post("/api/v1/glucose", json=GLUCOSE_PAYLOAD)
    response = await client.get("/api/v1/glucose")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 1


@pytest.mark.unit
async def test_get_glucose_limit(client: AsyncClient) -> None:
    response = await client.get("/api/v1/glucose?limit=1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["readings"]) <= 1


@pytest.mark.unit
async def test_post_glucose_invalid_value(client: AsyncClient) -> None:
    bad = {**GLUCOSE_PAYLOAD, "glucose_mg_dl": 999}
    response = await client.post("/api/v1/glucose", json=bad)
    assert response.status_code == 422


@pytest.mark.unit
async def test_get_glucose_from_to_filter(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/glucose",
        params={"from": "2030-01-01T00:00:00Z", "to": "2030-12-31T00:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["count"] == 0
