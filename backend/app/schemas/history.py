from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    organization_id: UUID
    created_by_user_id: UUID | None
    created_at: datetime
    updated_at: datetime


class VersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    version_number: int
    label: str | None
    processing_status: str
    source_file_metadata: dict | None
    created_at: datetime
    updated_at: datetime


class HistoryResponse(BaseModel):
    project: ProjectResponse
    versions: list[VersionResponse]
