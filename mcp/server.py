#!/usr/bin/env python3
"""
GlucoAssist MCP Server

Exposes real-time GlucoAssist data as MCP tools so an AI assistant
(e.g. GitHub Copilot CLI) can query live glucose, IOB, forecasts, and
logs without the user having to copy-paste data manually.

Configuration (environment variables):
  GLUCOASSIST_API_URL  Base URL of the running GlucoAssist container
                       (default: http://localhost:3500)

Wire-up (add to ~/.copilot/mcp-config.json):
  {
    "mcpServers": {
      "glucoassist": {
        "command": "python3",
        "args": ["/path/to/GlucoAssist/mcp/server.py"],
        "env": { "GLUCOASSIST_API_URL": "http://localhost:3500" }
      }
    }
  }
"""

import os
from datetime import UTC, datetime, timedelta

import httpx
from mcp.server.fastmcp import FastMCP

BASE_URL = os.getenv("GLUCOASSIST_API_URL", "http://localhost:3500").rstrip("/")
API = f"{BASE_URL}/api/v1"

mcp = FastMCP("GlucoAssist")


def _get(path: str, **params: object) -> dict:
    """Synchronous GET helper — MCP tool functions run in a thread pool."""
    filtered = {k: v for k, v in params.items() if v is not None}
    with httpx.Client(timeout=10) as client:
        r = client.get(f"{API}{path}", params=filtered)
        r.raise_for_status()
        return r.json()


def _post(path: str, body: dict) -> dict:
    with httpx.Client(timeout=10) as client:
        r = client.post(f"{API}{path}", json=body)
        r.raise_for_status()
        return r.json()


# ─── Tools ───────────────────────────────────────────────────────────────────


@mcp.tool()
def get_status() -> dict:
    """
    Return the current GlucoAssist snapshot:
    - Latest CGM reading (glucose mg/dL, trend arrow, timestamp)
    - 24-hour statistics (avg glucose, min, max, time-in-range %)
    - Active insulin on board (IOB, units)
    - Reading count in the last 24 hours

    Use this as your default first call to understand the user's current state.
    """
    return _get("/summary")


@mcp.tool()
def get_glucose_history(hours: int = 4) -> dict:
    """
    Return recent CGM glucose readings in reverse-chronological order.

    Args:
        hours: How many hours of history to return (default 4, max 24).
               Each reading includes timestamp (UTC ISO), glucose_mg_dl,
               trend_arrow, source, and device_id.
    """
    hours = min(max(hours, 1), 24)
    since = (datetime.now(tz=UTC) - timedelta(hours=hours)).isoformat()
    return _get("/glucose", **{"from": since, "limit": 500})


@mcp.tool()
def get_forecast() -> dict:
    """
    Return the ML-based glucose forecast for the next 30, 60, 90, and 120
    minutes, along with rule-based action suggestions.

    Each horizon includes:
    - predicted_mg_dl: expected glucose value
    - confidence_interval_low / high: 80% CI
    - risk_level: "low" | "moderate" | "high"

    Suggestions include urgency ("info" | "warning" | "critical") and a
    recommended action (e.g. eat 15g fast carbs, take 0.5u correction).

    Returns an empty forecast list when the ML model has not been trained yet.
    """
    return _get("/forecast")


@mcp.tool()
def get_insulin_log(hours: int = 24) -> dict:
    """
    Return recent insulin dose entries (both rapid and long-acting).

    Args:
        hours: How many hours of history to return (default 24).
               Each entry includes timestamp, units, type (rapid/long), notes.
    """
    hours = min(max(hours, 1), 168)  # cap at 7 days
    since = (datetime.now(tz=UTC) - timedelta(hours=hours)).isoformat()
    return _get("/insulin", **{"from": since, "limit": 200})


@mcp.tool()
def get_meal_log(hours: int = 24) -> dict:
    """
    Return recent meal entries.

    Args:
        hours: How many hours of history to return (default 24).
               Each entry includes timestamp, carbs_g, label, notes,
               and food_item_ids.
    """
    hours = min(max(hours, 1), 168)
    since = (datetime.now(tz=UTC) - timedelta(hours=hours)).isoformat()
    return _get("/meal", **{"from": since, "limit": 200})


@mcp.tool()
def get_analytics() -> dict:
    """
    Return aggregated glucose analytics across multiple rolling windows:
    - 30-day, 60-day, 90-day statistics (avg, TIR, std dev)
    - Estimated HbA1c based on 90-day average glucose
    - Detected glucose patterns (dawn phenomenon, post-meal spikes, etc.)
    - Personalised recommendations

    Use this for medium/long-term trend analysis, not real-time status.
    """
    stats = _get("/analytics/stats")
    hba1c = _get("/analytics/hba1c")
    patterns = _get("/analytics/patterns")
    recommendations = _get("/analytics/recommendations")
    return {
        "stats": stats,
        "hba1c": hba1c,
        "patterns": patterns,
        "recommendations": recommendations,
    }


@mcp.tool()
def get_ratios() -> dict:
    """
    Return the user's estimated insulin-to-carb ratios (ICR) and
    correction factors (CF) broken down by time-of-day slot.

    ICR: grams of carbohydrate covered by 1 unit of rapid insulin.
    CF:  how many mg/dL one unit of insulin lowers glucose.

    These are derived from the Intelligence feature and are used for
    dose proposals. Use this to understand the user's insulin sensitivity.
    """
    return _get("/ratios")


@mcp.tool()
def get_dose_proposal(carbs_g: float, hour: int | None = None) -> dict:
    """
    Calculate a meal bolus dose proposal for the given carb intake.

    Args:
        carbs_g: Grams of carbohydrates to cover.
        hour:    Hour of day (0-23) to use for ratio lookup.
                 Defaults to the current UTC hour if omitted.

    Returns the proposed insulin units, the ICR used, and the time slot.
    Decision-support only — confirm with the user before logging.
    """
    params: dict = {"carbs_g": carbs_g}
    if hour is not None:
        params["hour"] = hour
    return _get("/ratios/dose-proposal", **params)


@mcp.tool()
def log_insulin(units: float, type: str = "rapid", notes: str | None = None) -> dict:
    """
    Log an insulin dose NOW (uses current UTC timestamp).

    Args:
        units: Number of units administered (e.g. 4.5).
        type:  "rapid" or "long" (default "rapid").
        notes: Optional free-text note.

    IMPORTANT: Always confirm with the user before calling this tool.
    This writes to the database and affects IOB calculations.
    """
    if type not in ("rapid", "long"):
        return {"error": "type must be 'rapid' or 'long'"}
    body = {
        "timestamp": datetime.now(tz=UTC).isoformat(),
        "units": units,
        "type": type,
    }
    if notes:
        body["notes"] = notes
    return _post("/insulin", body)


@mcp.tool()
def log_meal(carbs_g: float, label: str | None = None, notes: str | None = None) -> dict:
    """
    Log a meal entry NOW (uses current UTC timestamp).

    Args:
        carbs_g: Grams of carbohydrates consumed.
        label:   Optional meal description (e.g. "oatmeal with banana").
        notes:   Optional free-text note.

    IMPORTANT: Always confirm with the user before calling this tool.
    This writes to the database and affects COB calculations.
    """
    body: dict = {
        "timestamp": datetime.now(tz=UTC).isoformat(),
        "carbs_g": carbs_g,
    }
    if label:
        body["label"] = label
    if notes:
        body["notes"] = notes
    return _post("/meal", body)


if __name__ == "__main__":
    mcp.run()
