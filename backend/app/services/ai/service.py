from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import AIInsightItem, AIInsightRun, AnalysisResult, Dataset, Project, ProjectVersion
from app.services.ai.context import build_context
from app.services.ai.models import AIAnalystOutput
from app.services.ai.prompts import SYSTEM_INSTRUCTION
from app.services.ai.providers.gemini import GeminiProvider


class AIAnalystService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _provider(self) -> GeminiProvider:
        if self.settings.ai_provider != "gemini":
            raise ValueError("Configured AI provider is not supported")
        if not self.settings.gemini_api_key:
            raise ValueError("AI provider is not configured")
        return GeminiProvider(self.settings.gemini_api_key, self.settings.gemini_model, self.settings.ai_timeout_seconds)

    @staticmethod
    def priority(classification: str, confidence: float, evidence_count: int, importance: float = 0.5) -> float:
        evidence_strength = min(1.0, evidence_count / 3)
        classification_weight = 1.0 if classification in {"FACT", "CALCULATION"} else 0.85
        return round(min(1.0, importance * confidence * evidence_strength * classification_weight), 4)

    def generate(self, db: Session, *, project: Project, version: ProjectVersion) -> tuple[AIInsightRun, AIAnalystOutput]:
        context = build_context(db, project=project, version=version, settings=self.settings)
        output = self._provider().generate_structured(system_instruction=SYSTEM_INSTRUCTION, context=context)
        run = AIInsightRun(organization_id=version.organization_id, project_id=project.id, version_id=version.id, provider=self.settings.ai_provider, model=self.settings.gemini_model, context_metadata={"limits": context.get("truncation", {}), "dataset_count": len(context.get("datasets", [])), "result_count": len(context.get("analytical_results", [])), "forecast_count": len(context.get("forecasts", []))}, status="completed")
        db.add(run)
        db.flush()
        for insight in output.insights:
            db.add(AIInsightItem(organization_id=version.organization_id, project_id=project.id, version_id=version.id, run_id=run.id, item_type="insight", classification=insight.classification, payload=insight.model_dump(mode="json"), priority_score=self.priority(insight.classification, insight.confidence, len(insight.evidence), insight.importance)))
        for recommendation in output.recommendations:
            db.add(AIInsightItem(organization_id=version.organization_id, project_id=project.id, version_id=version.id, run_id=run.id, item_type="recommendation", classification="RECOMMENDATION", payload=recommendation.model_dump(mode="json"), priority_score=self.priority("RECOMMENDATION", recommendation.confidence, len(recommendation.supporting_evidence))))
        for question in output.suggested_questions:
            db.add(AIInsightItem(organization_id=version.organization_id, project_id=project.id, version_id=version.id, run_id=run.id, item_type="suggested_question", classification="RECOMMENDATION", payload=question.model_dump(mode="json"), priority_score=0.3))
        for signal in output.future_signals:
            db.add(AIInsightItem(organization_id=version.organization_id, project_id=project.id, version_id=version.id, run_id=run.id, item_type="future_signal", classification="INFERENCE", payload=signal.model_dump(mode="json"), priority_score=self.priority("INFERENCE", signal.confidence, len(signal.evidence))))
        db.commit()
        db.refresh(run)
        return run, output
