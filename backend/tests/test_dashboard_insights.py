import json

import pytest
from fastapi import HTTPException

from app.api import dashboard
from app.api.dashboard import DashboardContext
from app.core.config import Settings


def context() -> DashboardContext:
    return DashboardContext(
        dataset_name="sales.csv",
        row_count=120,
        primary_measure="Revenue",
        total=125000,
        average=1041.67,
        growth_percentage=8.4,
        primary_dimension="Region",
        leading_group="West",
        leading_group_share=42,
        available_fields=["Revenue", "Profit", "Region"],
    )


def test_dashboard_insight_requires_server_side_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dashboard, "get_settings", lambda: Settings(gemini_api_key=None, ai_api_key=None))

    with pytest.raises(HTTPException) as error:
        dashboard.generate_dashboard_insight(context(), _user=object())

    assert error.value.status_code == 503
    assert "GEMINI_API_KEY" in error.value.detail


def test_dashboard_insight_validates_gemini_json(monkeypatch: pytest.MonkeyPatch) -> None:
    class Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            output = {"headline": "Revenue is growing.", "summary": "Growth is positive. Validate the strongest region.", "actions": ["Compare regional margin."]}
            return {"candidates": [{"content": {"parts": [{"text": json.dumps(output)}]}}]}

    monkeypatch.setattr(dashboard, "get_settings", lambda: Settings(gemini_api_key="test-key"))
    monkeypatch.setattr(dashboard.httpx, "post", lambda *args, **kwargs: Response())

    result = dashboard.generate_dashboard_insight(context(), _user=object())

    assert result.headline == "Revenue is growing."
    assert result.actions == ["Compare regional margin."]
