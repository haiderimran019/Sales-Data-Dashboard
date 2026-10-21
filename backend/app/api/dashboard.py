import json
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.models import User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class DashboardContext(BaseModel):
    dataset_name: str = Field(max_length=200)
    row_count: int = Field(ge=0, le=10_000_000)
    primary_measure: str = Field(max_length=120)
    total: float
    average: float
    growth_percentage: float | None = None
    primary_dimension: str | None = Field(default=None, max_length=120)
    leading_group: str | None = Field(default=None, max_length=200)
    leading_group_share: float | None = None
    available_fields: list[str] = Field(default_factory=list, max_length=40)


class DashboardInsight(BaseModel):
    headline: str = Field(max_length=160)
    summary: str = Field(max_length=700)
    actions: list[str] = Field(min_length=1, max_length=3)


@router.post("/insights", response_model=DashboardInsight)
def generate_dashboard_insight(
    context: DashboardContext,
    _user: User = Depends(get_current_user),
) -> DashboardInsight:
    settings = get_settings()
    api_key = settings.gemini_api_key or settings.ai_api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini is not configured. Add GEMINI_API_KEY to the backend environment.",
        )

    prompt = (
        "You are a concise business analyst. Use only the supplied calculated summary. "
        "Do not invent causes, targets, forecasts, or external facts. Return JSON with: "
        "headline (one direct sentence), summary (two short sentences), and actions "
        "(1 to 3 practical next checks). Clearly frame actions as checks, not proven conclusions."
    )
    payload = {
        "system_instruction": {"parts": [{"text": prompt}]},
        "contents": [{"role": "user", "parts": [{"text": context.model_dump_json()}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.15},
    }
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    try:
        response = httpx.post(
            endpoint,
            headers={"x-goog-api-key": api_key},
            json=payload,
            timeout=settings.ai_timeout_seconds,
        )
        response.raise_for_status()
        body: dict[str, Any] = response.json()
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        return DashboardInsight.model_validate(json.loads(text))
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini could not generate a dashboard insight right now.",
        ) from exc
