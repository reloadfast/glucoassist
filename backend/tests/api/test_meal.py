import pytest
from httpx import AsyncClient

GLUCOSE_PAYLOAD_BASE = {
    "glucose_mg_dl": 120,
    "trend_arrow": "→",
    "source": "test",
}

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


@pytest.mark.unit
async def test_get_meal_response_not_found(client: AsyncClient) -> None:
    response = await client.get("/api/v1/meal/999999/response")
    assert response.status_code == 404


@pytest.mark.unit
async def test_get_meal_response_no_readings(client: AsyncClient) -> None:
    """A meal with no glucose data returns empty actual_readings."""
    create = await client.post("/api/v1/meal", json=MEAL_PAYLOAD)
    meal_id = create.json()["id"]
    response = await client.get(f"/api/v1/meal/{meal_id}/response")
    assert response.status_code == 200
    data = response.json()
    assert data["meal"]["id"] == meal_id
    assert data["actual_readings"] == []
    assert data["glucose_at_meal"] is None


@pytest.mark.unit
async def test_get_meal_response_with_readings(client: AsyncClient) -> None:
    """Glucose readings within 150 min window are returned; readings outside are excluded."""
    meal_ts = "2026-02-23T12:00:00Z"
    create = await client.post(
        "/api/v1/meal", json={"timestamp": meal_ts, "carbs_g": 60.0}
    )
    meal_id = create.json()["id"]

    # Inside window: +0 min, +30 min, +90 min, +149 min
    inside_timestamps = [
        "2026-02-23T12:00:00Z",
        "2026-02-23T12:30:00Z",
        "2026-02-23T13:30:00Z",
        "2026-02-23T14:29:00Z",
    ]
    # Outside window: -1 min (before meal), +151 min (after window)
    outside_timestamps = [
        "2026-02-23T11:59:00Z",
        "2026-02-23T14:31:00Z",
    ]
    for ts in inside_timestamps + outside_timestamps:
        await client.post(
            "/api/v1/glucose", json={**GLUCOSE_PAYLOAD_BASE, "timestamp": ts}
        )

    response = await client.get(f"/api/v1/meal/{meal_id}/response")
    assert response.status_code == 200
    data = response.json()
    assert len(data["actual_readings"]) == len(inside_timestamps)
    assert data["glucose_at_meal"] == 120
    # Readings returned in ascending timestamp order
    timestamps = [r["timestamp"] for r in data["actual_readings"]]
    assert timestamps == sorted(timestamps)


@pytest.mark.unit
async def test_get_meal_before_cursor(client: AsyncClient) -> None:
    base_ts = "2026-01-01T{:02d}:00:00Z"
    for hour in range(5):
        await client.post(
            "/api/v1/meal",
            json={"timestamp": base_ts.format(hour), "carbs_g": float(hour + 10)},
        )

    first = await client.get("/api/v1/meal", params={"limit": 3})
    assert first.status_code == 200
    first_entries = first.json()["entries"]
    assert len(first_entries) == 3

    cursor = first_entries[-1]["timestamp"]

    second = await client.get("/api/v1/meal", params={"limit": 3, "before": cursor})
    assert second.status_code == 200
    second_entries = second.json()["entries"]
    assert len(second_entries) == 2

    first_ids = {e["id"] for e in first_entries}
    second_ids = {e["id"] for e in second_entries}
    assert first_ids.isdisjoint(second_ids)

    from datetime import datetime, timezone

    cursor_dt = datetime.fromisoformat(cursor.replace("Z", "+00:00"))
    for entry in second_entries:
        entry_dt = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
        assert entry_dt < cursor_dt
