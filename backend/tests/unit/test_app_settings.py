"""Unit tests for app_settings API."""

import pytest
from httpx import AsyncClient


@pytest.mark.unit
class TestAppSettingsDefaults:
    async def test_get_returns_defaults_on_empty_db(self, client: AsyncClient):
        """GET /app-settings seeds and returns all 3 defaults."""
        resp = await client.get("/api/v1/app-settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["autoresearcher_enabled"] == "false"
        assert "autoresearcher_ollama_url" in data
        assert "autoresearcher_ollama_model" in data

    async def test_put_upserts_value(self, client: AsyncClient):
        """PUT a new value; GET confirms it."""
        resp = await client.put(
            "/api/v1/app-settings/autoresearcher_enabled",
            json={"value": "true"},
        )
        assert resp.status_code == 200
        assert resp.json()["value"] == "true"

        resp2 = await client.get("/api/v1/app-settings")
        assert resp2.json()["autoresearcher_enabled"] == "true"

    async def test_put_missing_value_field_returns_422(self, client: AsyncClient):
        resp = await client.put(
            "/api/v1/app-settings/some_key",
            json={"wrong_field": "oops"},
        )
        assert resp.status_code == 422

    async def test_put_custom_key(self, client: AsyncClient):
        """Can PUT any key, not just pre-seeded ones."""
        resp = await client.put(
            "/api/v1/app-settings/custom_key",
            json={"value": "custom_value"},
        )
        assert resp.status_code == 200
        resp2 = await client.get("/api/v1/app-settings")
        assert resp2.json().get("custom_key") == "custom_value"
