from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AnalysisResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dataset_id: UUID | None
    run_id: UUID
    analysis_type: str
    title: str
    description: str
    status: str
    calculation: dict
    inputs: dict
    result_data: dict | None
    units: str | None
    result_scope: str
    warnings: list[str] | None
    created_at: datetime


class AnalysisRunResponse(BaseModel):
    id: UUID
    status: str
    plan: dict
    created_at: datetime
    results: list[AnalysisResultResponse]


class AnalysisPlanResponse(BaseModel):
    version: int
    analyses: list[dict]
    relationships_considered: int
    notes: list[str]
