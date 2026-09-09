from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ForecastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    project_id: UUID
    version_id: UUID
    dataset_id: UUID
    date_column: str
    measure_column: str
    frequency: str
    historical_observation_count: int
    forecast_horizon: int
    historical_values: list[dict]
    forecast_values: list[dict]
    lower_bound: list[dict]
    upper_bound: list[dict]
    method: str
    mae: float | None
    warnings: list[str] | None
    result_scope: str
    created_at: datetime
