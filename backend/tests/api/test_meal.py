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


@pytest.mark.unit
async def test_get_meal_empty(client: AsyncClient) -> None:
    response = await client.get("/api/v1/meal")
    assert response.status_code == 200
    data = response.json()
    assert data["entries"] == []
    assert data["count"] == 0


@pytest.mark.unit
async def test_get_meal_with_data(client: AsyncClient) -> None:
    await client.post("/api/v1/meal", json=MEAL_PAYLOAD)
    response = await client.get("/api/v1/meal")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 1
    assert data["entries"][0]["carbs_g"] == 45.0


@pytest.mark.unit
async def test_get_meal_filters(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/meal",
        params={"from": "2030-01-01T00:00:00Z", "to": "2030-12-31T00:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.unit
async def test_delete_meal(client: AsyncClient) -> None:
    create = await client.post("/api/v1/meal", json=MEAL_PAYLOAD)
    meal_id = create.json()["id"]
    response = await client.delete(f"/api/v1/meal/{meal_id}")
    assert response.status_code == 204
    list_resp = await client.get("/api/v1/meal")
    ids = [e["id"] for e in list_resp.json()["entries"]]
    assert meal_id not in ids


@pytest.mark.unit
async def test_delete_meal_not_found(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/meal/999999")
    assert response.status_code == 404
