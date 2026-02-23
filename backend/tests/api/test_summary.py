import pytest
from httpx import AsyncClient


@pytest.mark.unit
async def test_summary_empty_state(client: AsyncClient) -> None:
    response = await client.get("/api/v1/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["reading_count"] == 0
    assert data["latest_reading"] is None
    assert data["avg_glucose"] is None
    assert data["time_in_range_pct"] is None


@pytest.mark.unit
async def test_summary_with_data(client: AsyncClient) -> None:
    # Post a reading within the last 24h
    import datetime

    now = datetime.datetime.now(tz=datetime.UTC)
    payload = {
        "timestamp": now.isoformat(),
        "glucose_mg_dl": 110,
        "source": "manual",
    }
    await client.post("/api/v1/glucose", json=payload)

    response = await client.get("/api/v1/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["reading_count"] >= 1
    assert data["avg_glucose"] is not None
    assert data["time_in_range_pct"] is not None
    assert data["latest_reading"] is not None
