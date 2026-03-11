"""Integration tests for the autoresearcher API endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock

from app.services import autoresearcher as ar_service


@pytest.mark.integration
class TestAutoresearcherAPI:
    async def test_status_idle_by_default(self, client: AsyncClient):
        resp = await client.get("/api/v1/autoresearcher/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["state"] in ("idle", "error")

    async def test_start_run_when_disabled_returns_403(self, client: AsyncClient):
        """If autoresearcher_enabled=false, POST /run returns 403."""
        await client.put(
            "/api/v1/app-settings/autoresearcher_enabled", json={"value": "false"}
        )
        resp = await client.post("/api/v1/autoresearcher/run", json={"n_experiments": 1})
        assert resp.status_code == 403

    async def test_start_run_returns_202_when_enabled(
        self, client: AsyncClient, monkeypatch
    ):
        """POST /run returns 202 with run_id when enabled and service is mocked."""
        await client.put(
            "/api/v1/app-settings/autoresearcher_enabled", json={"value": "true"}
        )
        monkeypatch.setattr(ar_service, "start_run", lambda **_: "test-run-id-123")

        resp = await client.post("/api/v1/autoresearcher/run", json={"n_experiments": 5})
        assert resp.status_code == 202
        assert resp.json()["run_id"] == "test-run-id-123"

    async def test_cancel_with_no_run_returns_404(self, client: AsyncClient):
        with ar_service._lock:
            ar_service._state.state = "idle"
        resp = await client.delete("/api/v1/autoresearcher/run")
        assert resp.status_code == 404

    async def test_log_returns_list(self, client: AsyncClient):
        resp = await client.get("/api/v1/autoresearcher/log")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_log_limit_parameter(self, client: AsyncClient):
        resp = await client.get("/api/v1/autoresearcher/log?limit=5")
        assert resp.status_code == 200

    async def test_ping_ollama_reachable(self, client: AsyncClient):
        """GET /ollama/ping returns reachable=True when Ollama responds."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"version": "0.3.0"}
        with patch("app.api.v1.autoresearcher.http_requests.get", return_value=mock_resp):
            resp = await client.get("/api/v1/autoresearcher/ollama/ping")
        assert resp.status_code == 200
        data = resp.json()
        assert data["reachable"] is True
        assert data["version"] == "0.3.0"

    async def test_ping_ollama_unreachable(self, client: AsyncClient):
        """GET /ollama/ping returns reachable=False on connection error."""
        import requests as req
        with patch(
            "app.api.v1.autoresearcher.http_requests.get",
            side_effect=req.exceptions.ConnectionError("refused"),
        ):
            resp = await client.get("/api/v1/autoresearcher/ollama/ping")
        assert resp.status_code == 200
        data = resp.json()
        assert data["reachable"] is False
        assert "error" in data

    async def test_list_ollama_models_success(self, client: AsyncClient):
        """GET /ollama/models returns model names list."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            "models": [{"name": "llama3.1:8b"}, {"name": "mistral:7b"}]
        }
        with patch("app.api.v1.autoresearcher.http_requests.get", return_value=mock_resp):
            resp = await client.get("/api/v1/autoresearcher/ollama/models")
        assert resp.status_code == 200
        assert resp.json()["models"] == ["llama3.1:8b", "mistral:7b"]

    async def test_list_ollama_models_unreachable_returns_502(self, client: AsyncClient):
        """GET /ollama/models returns 502 when Ollama is down."""
        import requests as req
        with patch(
            "app.api.v1.autoresearcher.http_requests.get",
            side_effect=req.exceptions.ConnectionError("refused"),
        ):
            resp = await client.get("/api/v1/autoresearcher/ollama/models")
        assert resp.status_code == 502
