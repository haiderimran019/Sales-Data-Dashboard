from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DatasetColumnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dataset_id: UUID
    original_name: str
    normalized_name: str
    inferred_type: str
    semantic_type: str
    confidence: float
    evidence: list[str] | None
    null_count: int
    null_percentage: float
    unique_count: int
    uniqueness_percentage: float
    sample_values: list | None
    statistics: dict | None
    top_values: list[dict] | None
    outlier_count: int
    outlier_percentage: float
    outlier_method: str | None


class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    version_id: UUID
    file_id: UUID
    name: str
    dataset_type: str
    row_count: int | None
    column_count: int
    profile_scope: str
    quality_score: float | None
    quality_details: dict | None
    domain: str
    domain_confidence: float
    domain_evidence: list[str] | None
    metadata: dict | None = Field(default=None, validation_alias="dataset_metadata", serialization_alias="metadata")
    created_at: datetime
    updated_at: datetime


class RelationshipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    left_dataset_id: UUID
    left_column_id: UUID
    right_dataset_id: UUID
    right_column_id: UUID
    relationship_type: str
    confidence: float
    evidence: dict | None


class OpportunityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dataset_id: UUID | None
    kind: str
    title: str
    description: str
    evidence: list[str] | None
    confidence: float


class VersionProfileResponse(BaseModel):
    datasets: list[DatasetResponse]
    columns: list[DatasetColumnResponse]
    relationships: list[RelationshipResponse]
    opportunities: list[OpportunityResponse]
