import pytest
from httpx import AsyncClient

INSULIN_PAYLOAD = {
    "timestamp": "2026-02-23T12:00:00Z",
    "units": 4.0,
    "type": "rapid",
    "notes": "before lunch",
}


@pytest.mark.unit
async def test_post_insulin(client: AsyncClient) -> None:
    response = await client.post("/api/v1/insulin", json=INSULIN_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["units"] == 4.0
    assert data["type"] == "rapid"
    assert data["notes"] == "before lunch"
    assert "id" in data


@pytest.mark.unit
async def test_post_insulin_invalid_type(client: AsyncClient) -> None:
    bad = {**INSULIN_PAYLOAD, "type": "basal"}
    response = await client.post("/api/v1/insulin", json=bad)
    assert response.status_code == 422


@pytest.mark.unit
async def test_post_insulin_no_notes(client: AsyncClient) -> None:
    payload = {k: v for k, v in INSULIN_PAYLOAD.items() if k != "notes"}
    response = await client.post("/api/v1/insulin", json=payload)
    assert response.status_code == 201
    assert response.json()["notes"] is None


@pytest.mark.unit
async def test_get_insulin_empty(client: AsyncClient) -> None:
    response = await client.get("/api/v1/insulin")
    assert response.status_code == 200
    data = response.json()
    assert data["entries"] == []
    assert data["count"] == 0


@pytest.mark.unit
async def test_get_insulin_with_data(client: AsyncClient) -> None:
    await client.post("/api/v1/insulin", json=INSULIN_PAYLOAD)
    response = await client.get("/api/v1/insulin")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 1
    assert data["entries"][0]["units"] == 4.0


@pytest.mark.unit
async def test_get_insulin_filters(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/insulin",
        params={"from": "2030-01-01T00:00:00Z", "to": "2030-12-31T00:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.unit
async def test_delete_insulin(client: AsyncClient) -> None:
    create = await client.post("/api/v1/insulin", json=INSULIN_PAYLOAD)
    dose_id = create.json()["id"]
    response = await client.delete(f"/api/v1/insulin/{dose_id}")
    assert response.status_code == 204
    # confirm gone
    list_resp = await client.get("/api/v1/insulin")
    ids = [e["id"] for e in list_resp.json()["entries"]]
    assert dose_id not in ids


@pytest.mark.unit
async def test_delete_insulin_not_found(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/insulin/999999")
    assert response.status_code == 404


@pytest.mark.unit
async def test_get_insulin_before_cursor(client: AsyncClient) -> None:
    base_ts = "2026-01-01T{:02d}:00:00Z"
    for hour in range(5):
        await client.post(
            "/api/v1/insulin",
            json={"timestamp": base_ts.format(hour), "units": float(hour + 1), "type": "rapid"},
        )

    # Fetch newest 3 (hours 4, 3, 2)
    first = await client.get("/api/v1/insulin", params={"limit": 3})
    assert first.status_code == 200
    first_entries = first.json()["entries"]
    assert len(first_entries) == 3

    # Cursor = oldest timestamp in first batch (hour 2)
    cursor = first_entries[-1]["timestamp"]

    # Fetch older entries using before cursor
    second = await client.get("/api/v1/insulin", params={"limit": 3, "before": cursor})
    assert second.status_code == 200
    second_entries = second.json()["entries"]
    assert len(second_entries) == 2  # hours 1 and 0

    # No overlap
    first_ids = {e["id"] for e in first_entries}
    second_ids = {e["id"] for e in second_entries}
    assert first_ids.isdisjoint(second_ids)

    # All second entries are older than cursor
    from datetime import datetime, timezone

    cursor_dt = datetime.fromisoformat(cursor.replace("Z", "+00:00"))
    for entry in second_entries:
        entry_dt = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
        assert entry_dt < cursor_dt
