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
