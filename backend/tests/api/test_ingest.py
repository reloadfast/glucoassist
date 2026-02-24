"""Tests for the Nightscout-compatible push receiver endpoint (POST /api/v1/entries)."""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

NOW_MS = int(datetime(2026, 2, 24, 10, 0, 0, tzinfo=UTC).timestamp() * 1000)

SGV_FLAT = {
    "type": "sgv",
    "sgv": 110,
    "date": NOW_MS,
    "direction": "Flat",
    "device": "libre-sensor",
}
SGV_SINGLE_UP = {
    "type": "sgv",
    "sgv": 130,
    "date": NOW_MS + 300_000,
    "direction": "SingleUp",
    "device": "libre-sensor",
}
NON_SGV = {"type": "mbg", "mbg": 110, "date": NOW_MS + 600_000}


@pytest.mark.unit
async def test_push_empty_list(client: AsyncClient) -> None:
    response = await client.post("/api/v1/entries", json=[])
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["received"] == 0
    assert data["inserted"] == 0


@pytest.mark.unit
async def test_push_inserts_sgv_entries(client: AsyncClient) -> None:
    response = await client.post("/api/v1/entries", json=[SGV_FLAT, SGV_SINGLE_UP])
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["received"] == 2
    assert data["inserted"] == 2


@pytest.mark.unit
async def test_push_skips_non_sgv(client: AsyncClient) -> None:
    response = await client.post("/api/v1/entries", json=[NON_SGV])
    assert response.status_code == 200
    data = response.json()
    assert data["received"] == 1
    assert data["inserted"] == 0


@pytest.mark.unit
async def test_push_deduplicates(client: AsyncClient) -> None:
    payload = [SGV_FLAT, SGV_SINGLE_UP]
    first = await client.post("/api/v1/entries", json=payload)
    second = await client.post("/api/v1/entries", json=payload)
    assert first.json()["inserted"] == 2
    assert second.json()["inserted"] == 0


@pytest.mark.unit
async def test_push_mixed_batch(client: AsyncClient) -> None:
    """Non-dict items in the array are silently ignored."""
    payload = [SGV_FLAT, "not-a-dict", None, SGV_SINGLE_UP]
    response = await client.post("/api/v1/entries", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["received"] == 4
    assert data["inserted"] == 2


@pytest.mark.unit
async def test_push_non_array_body_rejected(client: AsyncClient) -> None:
    """Sending a JSON object instead of an array should return 422."""
    response = await client.post("/api/v1/entries", json={"type": "sgv", "sgv": 120})
    assert response.status_code == 422
