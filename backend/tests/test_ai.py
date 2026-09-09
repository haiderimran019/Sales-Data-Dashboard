import pytest

from app.core.config import Settings
from app.services.ai.models import AIAnalystOutput
from app.services.ai.service import AIAnalystService


def evidence() -> dict:
    return {"statement": "Revenue increased 18.4%.", "source": "analysis result r1", "result_id": "r1", "scope": "exact"}


def test_structured_ai_output_requires_classification_and_evidence() -> None:
    output = AIAnalystOutput.model_validate({"insights": [{"title": "Revenue growth", "summary": "Revenue increased.", "insight_type": "trend", "classification": "CALCULATION", "evidence": [evidence()], "confidence": 0.9, "uncertainty": "No causal conclusion.", "importance": 0.8, "explanation": "The supplied time series shows an increase."}]})

    assert output.insights[0].classification == "CALCULATION"
    with pytest.raises(ValueError):
        AIAnalystOutput.model_validate({"insights": [{"title": "Forecast", "summary": "Revenue will rise.", "insight_type": "forecast", "classification": "PREDICTION", "evidence": [evidence()], "confidence": 0.5, "uncertainty": "Unknown.", "importance": 0.5, "explanation": "Unsupported forecast."}]})


def test_priority_score_is_deterministic() -> None:
    score = AIAnalystService.priority("CALCULATION", 0.9, 2, 0.8)

    assert score == 0.48


def test_bounded_context_does_not_include_raw_rows() -> None:
    context_keys = {"datasets", "columns", "analytical_results", "documents", "truncation"}
    assert "rows" not in context_keys


def test_provider_error_does_not_expose_response_body() -> None:
    from app.services.ai.providers.gemini import GeminiProvider

    provider = GeminiProvider("test-key", "test-model")
    assert provider.name == "gemini"
    assert provider.timeout_seconds == 30.0
