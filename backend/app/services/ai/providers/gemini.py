import json
from typing import Any

import httpx

from app.services.ai.models import AIAnalystOutput


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout_seconds: float = 30.0) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def generate_structured(self, *, system_instruction: str, context: dict[str, Any]) -> AIAnalystOutput:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": json.dumps(context, ensure_ascii=True)}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }
        try:
            response = httpx.post(endpoint, headers={"x-goog-api-key": self.api_key}, json=payload, timeout=self.timeout_seconds)
            response.raise_for_status()
            body = response.json()
            text = body["candidates"][0]["content"]["parts"][0]["text"]
            return AIAnalystOutput.model_validate(json.loads(text))
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise RuntimeError("The AI provider returned an invalid or unavailable response") from exc
