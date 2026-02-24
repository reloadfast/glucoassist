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
    assert data["iob_units"] is None  # no insulin logged


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
    assert data["iob_units"] is None  # no insulin logged


@pytest.mark.unit
async def test_summary_iob_with_fresh_dose(client: AsyncClient) -> None:
    """Fresh rapid-acting dose should surface as iob_units > 0."""
    import datetime

    now = datetime.datetime.now(tz=datetime.UTC)
    await client.post(
        "/api/v1/insulin",
        json={"timestamp": now.isoformat(), "units": 4.0, "type": "rapid"},
    )

    response = await client.get("/api/v1/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["iob_units"] is not None
    assert data["iob_units"] > 3.5  # fresh dose, nearly full units active


@pytest.mark.unit
async def test_summary_iob_long_acting_excluded(client: AsyncClient) -> None:
    """Long-acting dose must not contribute to iob_units."""
    import datetime

    now = datetime.datetime.now(tz=datetime.UTC)
    await client.post(
        "/api/v1/insulin",
        json={"timestamp": now.isoformat(), "units": 20.0, "type": "long"},
    )

    response = await client.get("/api/v1/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["iob_units"] is None
