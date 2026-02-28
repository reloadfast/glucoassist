"""Tests for /api/v1/food-items CRUD and meal integration."""

import pytest
from httpx import AsyncClient

APPLE = {
    "name": "Apple",
    "carbs_per_100g": 14.0,
    "default_portion_g": 150.0,
    "aliases": ["apples", "fuji"],
}
OATS = {
    "name": "Rolled oats",
    "carbs_per_100g": 66.0,
    "default_portion_g": 80.0,
    "aliases": ["oats", "porridge"],
}


# ─── Create ──────────────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_create_food_item(client: AsyncClient) -> None:
    r = await client.post("/api/v1/food-items", json=APPLE)
    assert r.status_code == 201
    d = r.json()
    assert d["name"] == "Apple"
    assert d["carbs_per_100g"] == 14.0
    assert d["default_portion_g"] == 150.0
    assert d["aliases"] == ["apples", "fuji"]
    assert d["use_count"] == 0
    assert d["last_used_at"] is None
    assert "id" in d


@pytest.mark.unit
async def test_create_food_item_no_aliases(client: AsyncClient) -> None:
    payload = {"name": "Banana", "carbs_per_100g": 22.0, "default_portion_g": 120.0, "aliases": []}
    r = await client.post("/api/v1/food-items", json=payload)
    assert r.status_code == 201
    assert r.json()["aliases"] == []


@pytest.mark.unit
async def test_create_food_item_validation(client: AsyncClient) -> None:
    """carbs_per_100g cannot exceed 500."""
    bad = {**APPLE, "carbs_per_100g": 600.0}
    r = await client.post("/api/v1/food-items", json=bad)
    assert r.status_code == 422


# ─── List ────────────────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_list_food_items_empty(client: AsyncClient) -> None:
    r = await client.get("/api/v1/food-items")
    assert r.status_code == 200
    d = r.json()
    assert d["items"] == []
    assert d["count"] == 0


@pytest.mark.unit
async def test_list_food_items_returns_all(client: AsyncClient) -> None:
    await client.post("/api/v1/food-items", json=APPLE)
    await client.post("/api/v1/food-items", json=OATS)
    r = await client.get("/api/v1/food-items")
    assert r.status_code == 200
    assert r.json()["count"] == 2


@pytest.mark.unit
async def test_list_food_items_search_name(client: AsyncClient) -> None:
    await client.post("/api/v1/food-items", json=APPLE)
    await client.post("/api/v1/food-items", json=OATS)
    r = await client.get("/api/v1/food-items", params={"q": "apple"})
    assert r.status_code == 200
    d = r.json()
    assert d["count"] == 1
    assert d["items"][0]["name"] == "Apple"


@pytest.mark.unit
async def test_list_food_items_search_alias(client: AsyncClient) -> None:
    await client.post("/api/v1/food-items", json=APPLE)
    await client.post("/api/v1/food-items", json=OATS)
    r = await client.get("/api/v1/food-items", params={"q": "porridge"})
    assert r.status_code == 200
    d = r.json()
    assert d["count"] == 1
    assert d["items"][0]["name"] == "Rolled oats"


# ─── Get one ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_get_food_item(client: AsyncClient) -> None:
    create = await client.post("/api/v1/food-items", json=APPLE)
    item_id = create.json()["id"]
    r = await client.get(f"/api/v1/food-items/{item_id}")
    assert r.status_code == 200
    assert r.json()["id"] == item_id


@pytest.mark.unit
async def test_get_food_item_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/v1/food-items/999999")
    assert r.status_code == 404


# ─── Update ──────────────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_update_food_item(client: AsyncClient) -> None:
    create = await client.post("/api/v1/food-items", json=APPLE)
    item_id = create.json()["id"]
    r = await client.put(
        f"/api/v1/food-items/{item_id}",
        json={"carbs_per_100g": 13.0, "aliases": ["apple", "granny smith"]},
    )
    assert r.status_code == 200
    d = r.json()
    assert d["carbs_per_100g"] == 13.0
    assert d["aliases"] == ["apple", "granny smith"]
    assert d["name"] == "Apple"  # unchanged


@pytest.mark.unit
async def test_update_food_item_not_found(client: AsyncClient) -> None:
    r = await client.put("/api/v1/food-items/999999", json={"name": "Ghost"})
    assert r.status_code == 404


# ─── Delete ──────────────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_delete_food_item(client: AsyncClient) -> None:
    create = await client.post("/api/v1/food-items", json=APPLE)
    item_id = create.json()["id"]
    r = await client.delete(f"/api/v1/food-items/{item_id}")
    assert r.status_code == 204
    r2 = await client.get(f"/api/v1/food-items/{item_id}")
    assert r2.status_code == 404


@pytest.mark.unit
async def test_delete_food_item_not_found(client: AsyncClient) -> None:
    r = await client.delete("/api/v1/food-items/999999")
    assert r.status_code == 404


# ─── Meal integration ────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_meal_with_food_items_updates_use_count(client: AsyncClient) -> None:
    """Posting a meal with food_item_ids increments use_count and sets last_used_at."""
    create = await client.post("/api/v1/food-items", json=APPLE)
    item_id = create.json()["id"]
    assert create.json()["use_count"] == 0

    await client.post(
        "/api/v1/meal",
        json={"timestamp": "2026-02-28T12:00:00Z", "carbs_g": 21.0, "food_item_ids": [item_id]},
    )

    r = await client.get(f"/api/v1/food-items/{item_id}")
    d = r.json()
    assert d["use_count"] == 1
    assert d["last_used_at"] is not None


@pytest.mark.unit
async def test_meal_food_item_ids_stored(client: AsyncClient) -> None:
    """food_item_ids are returned as a list in the meal response."""
    create = await client.post("/api/v1/food-items", json=APPLE)
    item_id = create.json()["id"]

    meal_r = await client.post(
        "/api/v1/meal",
        json={"timestamp": "2026-02-28T13:00:00Z", "carbs_g": 21.0, "food_item_ids": [item_id]},
    )
    assert meal_r.status_code == 201
    assert meal_r.json()["food_item_ids"] == [item_id]


@pytest.mark.unit
async def test_meal_without_food_items(client: AsyncClient) -> None:
    """Meals created without food_item_ids have food_item_ids = None."""
    r = await client.post(
        "/api/v1/meal",
        json={"timestamp": "2026-02-28T14:00:00Z", "carbs_g": 30.0},
    )
    assert r.status_code == 201
    assert r.json()["food_item_ids"] is None


@pytest.mark.unit
async def test_meal_with_multiple_food_items(client: AsyncClient) -> None:
    """Multiple food items in one meal all get their use_count incremented."""
    id1 = (await client.post("/api/v1/food-items", json=APPLE)).json()["id"]
    id2 = (await client.post("/api/v1/food-items", json=OATS)).json()["id"]

    await client.post(
        "/api/v1/meal",
        json={
            "timestamp": "2026-02-28T15:00:00Z",
            "carbs_g": 74.0,
            "food_item_ids": [id1, id2],
        },
    )

    r1 = (await client.get(f"/api/v1/food-items/{id1}")).json()
    r2 = (await client.get(f"/api/v1/food-items/{id2}")).json()
    assert r1["use_count"] == 1
    assert r2["use_count"] == 1


@pytest.mark.unit
async def test_list_sorted_by_use_count(client: AsyncClient) -> None:
    """Food items are returned sorted by use_count descending."""
    id1 = (await client.post("/api/v1/food-items", json=APPLE)).json()["id"]
    id2 = (await client.post("/api/v1/food-items", json=OATS)).json()["id"]

    # Use OATS twice, APPLE once
    for ts in ["2026-02-28T09:00:00Z", "2026-02-28T10:00:00Z"]:
        await client.post(
            "/api/v1/meal",
            json={"timestamp": ts, "carbs_g": 52.8, "food_item_ids": [id2]},
        )
    await client.post(
        "/api/v1/meal",
        json={"timestamp": "2026-02-28T11:00:00Z", "carbs_g": 21.0, "food_item_ids": [id1]},
    )

    r = await client.get("/api/v1/food-items")
    items = r.json()["items"]
    assert items[0]["id"] == id2  # oats: use_count=2
    assert items[1]["id"] == id1  # apple: use_count=1
