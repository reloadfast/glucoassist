import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.food_item import FoodItem
from app.models.meal import Meal
from app.schemas.food_item import (
    FoodItemCreate,
    FoodItemListResponse,
    FoodItemOut,
    FoodItemUpdate,
)

router = APIRouter(tags=["food-items"])


def _serialize(item: FoodItem) -> FoodItemOut:
    """Convert DB row to schema, deserialising the aliases JSON field."""
    aliases: list[str] = []
    if item.aliases:
        try:
            aliases = json.loads(item.aliases)
        except (ValueError, TypeError):
            aliases = []
    return FoodItemOut(
        id=item.id,
        name=item.name,
        carbs_per_100g=item.carbs_per_100g,
        default_portion_g=item.default_portion_g,
        aliases=aliases,
        created_at=item.created_at,
        last_used_at=item.last_used_at,
        use_count=item.use_count,
    )


@router.get("/food-items/suggestions", response_model=FoodItemListResponse)
def suggest_food_items(
    hour: int = Query(ge=0, le=23, description="Current hour (0–23) for time-of-day scoring"),
    db: Session = Depends(get_db),
) -> FoodItemListResponse:
    """Return up to 6 food items frequently eaten near the requested hour."""
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=90)
    meals = (
        db.query(Meal)
        .filter(Meal.timestamp >= cutoff, Meal.food_item_ids.isnot(None))
        .all()
    )

    # Score food_item_ids by meals within ±2 hours of requested hour
    counts: Counter[int] = Counter()
    for meal in meals:
        meal_hour = meal.timestamp.astimezone(timezone.utc).hour
        diff = min(abs(meal_hour - hour), 24 - abs(meal_hour - hour))
        if diff <= 2:
            try:
                ids: list[int] = json.loads(meal.food_item_ids)  # type: ignore[arg-type]
                for fid in ids:
                    counts[fid] += 1
            except (ValueError, TypeError):
                pass

    top_ids: list[int]
    if counts:
        top_ids = [fid for fid, _ in counts.most_common(6)]
    else:
        # Fall back: top foods by overall use_count
        rows = (
            db.query(FoodItem)
            .order_by(FoodItem.use_count.desc(), FoodItem.last_used_at.desc().nullslast())
            .limit(6)
            .all()
        )
        top_ids = [r.id for r in rows]

    if not top_ids:
        return FoodItemListResponse(items=[], count=0)

    food_map = {
        f.id: f
        for f in db.query(FoodItem).filter(FoodItem.id.in_(top_ids)).all()
    }
    ordered = [_serialize(food_map[fid]) for fid in top_ids if fid in food_map]
    return FoodItemListResponse(items=ordered, count=len(ordered))


@router.get("/food-items", response_model=FoodItemListResponse)
def list_food_items(
    q: str | None = Query(default=None, description="Filter by name/alias substring"),
    db: Session = Depends(get_db),
) -> FoodItemListResponse:
    items = (
        db.query(FoodItem)
        .order_by(FoodItem.use_count.desc(), FoodItem.last_used_at.desc().nullslast())
        .all()
    )
    out = [_serialize(i) for i in items]
    if q:
        q_lower = q.lower()
        out = [
            i
            for i in out
            if q_lower in i.name.lower() or any(q_lower in a.lower() for a in i.aliases)
        ]
    return FoodItemListResponse(items=out, count=len(out))


@router.post("/food-items", response_model=FoodItemOut, status_code=201)
def create_food_item(payload: FoodItemCreate, db: Session = Depends(get_db)) -> FoodItemOut:
    item = FoodItem(
        name=payload.name,
        carbs_per_100g=payload.carbs_per_100g,
        default_portion_g=payload.default_portion_g,
        aliases=json.dumps(payload.aliases) if payload.aliases else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.get("/food-items/{item_id}", response_model=FoodItemOut)
def get_food_item(item_id: int, db: Session = Depends(get_db)) -> FoodItemOut:
    item = db.get(FoodItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Food item not found")
    return _serialize(item)


@router.put("/food-items/{item_id}", response_model=FoodItemOut)
def update_food_item(
    item_id: int, payload: FoodItemUpdate, db: Session = Depends(get_db)
) -> FoodItemOut:
    item = db.get(FoodItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Food item not found")
    if payload.name is not None:
        item.name = payload.name
    if payload.carbs_per_100g is not None:
        item.carbs_per_100g = payload.carbs_per_100g
    if payload.default_portion_g is not None:
        item.default_portion_g = payload.default_portion_g
    if payload.aliases is not None:
        item.aliases = json.dumps(payload.aliases)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.delete("/food-items/{item_id}", status_code=204)
def delete_food_item(item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(FoodItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Food item not found")
    db.delete(item)
    db.commit()
