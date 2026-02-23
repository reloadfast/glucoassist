import pytest
from httpx import AsyncClient

MEAL_PAYLOAD = {
    "timestamp": "2026-02-23T12:30:00Z",
    "carbs_g": 45.0,
    "label": "Lunch",
    "notes": "pasta",
}


@pytest.mark.unit
async def test_post_meal(client: AsyncClient) -> None:
    response = await client.post("/api/v1/meal", json=MEAL_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["carbs_g"] == 45.0
    assert data["label"] == "Lunch"
    assert "id" in data


@pytest.mark.unit
async def test_post_meal_negative_carbs(client: AsyncClient) -> None:
    bad = {**MEAL_PAYLOAD, "carbs_g": -5.0}
    response = await client.post("/api/v1/meal", json=bad)
    assert response.status_code == 422


@pytest.mark.unit
async def test_post_meal_minimal(client: AsyncClient) -> None:
    payload = {"timestamp": "2026-02-23T13:00:00Z", "carbs_g": 20.0}
    response = await client.post("/api/v1/meal", json=payload)
    assert response.status_code == 201
    assert response.json()["label"] is None
