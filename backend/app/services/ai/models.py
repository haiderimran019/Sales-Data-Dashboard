from typing import Literal

from pydantic import BaseModel, Field, model_validator

Classification = Literal["FACT", "CALCULATION", "INFERENCE", "PREDICTION", "RECOMMENDATION"]


class Evidence(BaseModel):
    statement: str = Field(min_length=1, max_length=1000)
    source: str = Field(min_length=1, max_length=300)
    result_id: str | None = None
    scope: Literal["exact", "estimated", "unknown"] = "unknown"


class Insight(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=1200)
    insight_type: str = Field(min_length=1, max_length=80)
    classification: Classification
    evidence: list[Evidence] = Field(min_length=1, max_length=5)
    metric: str | None = Field(default=None, max_length=200)
    calculation_reference: str | None = None
    confidence: float = Field(ge=0, le=1)
    uncertainty: str = Field(min_length=1, max_length=500)
    importance: float = Field(ge=0, le=1)
    explanation: str = Field(min_length=1, max_length=1500)


class Recommendation(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    recommendation: str = Field(min_length=1, max_length=1200)
    classification: Literal["RECOMMENDATION"] = "RECOMMENDATION"
    rationale: str = Field(min_length=1, max_length=1200)
    supporting_evidence: list[Evidence] = Field(min_length=1, max_length=5)
    expected_impact: str = Field(min_length=1, max_length=500)
    confidence: float = Field(ge=0, le=1)
    risks: list[str] = Field(default_factory=list, max_length=5)
    next_step: str = Field(min_length=1, max_length=500)


class SuggestedQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    reason: str = Field(min_length=1, max_length=800)
    related_analysis: str | None = None
    classification: Literal["RECOMMENDATION"] = "RECOMMENDATION"


class FutureSignal(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=1000)
    classification: Literal["INFERENCE"] = "INFERENCE"
    evidence: list[Evidence] = Field(min_length=1, max_length=5)
    direction: Literal["up", "down", "mixed", "unclear"]
    confidence: float = Field(ge=0, le=1)
    uncertainty: str = Field(min_length=1, max_length=500)
    caveats: list[str] = Field(default_factory=list, max_length=5)


class AIAnalystOutput(BaseModel):
    insights: list[Insight] = Field(default_factory=list, max_length=8)
    recommendations: list[Recommendation] = Field(default_factory=list, max_length=5)
    suggested_questions: list[SuggestedQuestion] = Field(default_factory=list, max_length=6)
    future_signals: list[FutureSignal] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def reject_predictions_without_forecast(self):
        for insight in self.insights:
            if insight.classification == "PREDICTION":
                raise ValueError("Predictions require a deterministic forecast artifact")
        return self
