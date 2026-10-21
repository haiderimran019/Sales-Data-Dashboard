from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AIInsightItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_type: str
    classification: str
    payload: dict
    priority_score: float
    created_at: datetime


class AIInsightRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: str
    model: str
    context_metadata: dict
    status: str
    created_at: datetime
    items: list[AIInsightItemResponse]
