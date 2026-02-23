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
