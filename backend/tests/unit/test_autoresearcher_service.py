"""Unit tests for the autoresearcher service (mocked Ollama)."""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.autoresearcher import (
    OllamaUnreachableError,
    _propose_experiment,
    _should_promote,
)


@pytest.mark.unit
class TestProposeExperiment:
    def test_returns_parsed_dict(self):
        payload = {
            "description": "Try LightGBM",
            "feature_config": {
                "lags": [1, 2, 3],
                "time_of_day": True,
                "roc_features": False,
                "garmin_features": False,
            },
            "model_config": {"algorithm": "lightgbm", "n_estimators": 100},
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"response": json.dumps(payload)}
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.autoresearcher.requests.post", return_value=mock_resp):
            result = _propose_experiment(
                "program text", [], "http://localhost:11434", "llama3.1:8b"
            )

        assert result["description"] == "Try LightGBM"
        assert result["feature_config"]["time_of_day"] is True

    def test_strips_markdown_fences(self):
        payload = {"description": "test", "feature_config": {}, "model_config": {}}
        fenced = f"```json\n{json.dumps(payload)}\n```"
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"response": fenced}
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.autoresearcher.requests.post", return_value=mock_resp):
            result = _propose_experiment("p", [], "http://localhost:11434", "llama3.1:8b")
        assert result["description"] == "test"

    def test_raises_on_connection_error(self):
        import requests as req_lib

        with patch(
            "app.services.autoresearcher.requests.post",
            side_effect=req_lib.exceptions.ConnectionError("refused"),
        ):
            with pytest.raises(OllamaUnreachableError):
                _propose_experiment("p", [], "http://localhost:11434", "llama3.1:8b")

    def test_includes_log_context(self):
        """The recent log entries are passed in the prompt."""
        payload = {"description": "t", "feature_config": {}, "model_config": {}}
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"response": json.dumps(payload)}
        mock_resp.raise_for_status = MagicMock()
        log_entries = [{"description": "prev exp", "mae_30": 16.0, "promoted": False}]

        with patch(
            "app.services.autoresearcher.requests.post", return_value=mock_resp
        ) as mock_post:
            _propose_experiment(
                "prog", log_entries, "http://localhost:11434", "llama3.1:8b"
            )
            call_kwargs = mock_post.call_args
            prompt_sent = call_kwargs[1]["json"]["prompt"]
            assert "prev exp" in prompt_sent


@pytest.mark.unit
class TestShouldPromote:
    def test_promotes_when_all_horizons_improve(self):
        candidate = {"30": 15.0, "60": 23.0, "90": 26.0, "120": 27.0}
        baseline = {"30": 17.74, "60": 25.18, "90": 27.73, "120": 28.60}
        assert _should_promote(candidate, baseline) is True

    def test_rejects_when_one_horizon_regresses(self):
        candidate = {"30": 15.0, "60": 23.0, "90": 26.0, "120": 29.0}  # 120 worse
        baseline = {"30": 17.74, "60": 25.18, "90": 27.73, "120": 28.60}
        assert _should_promote(candidate, baseline) is False

    def test_rejects_when_equal(self):
        baseline = {"30": 17.74, "60": 25.18, "90": 27.73, "120": 28.60}
        assert _should_promote(baseline, baseline) is False
