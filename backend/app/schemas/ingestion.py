from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupportedTypeResponse(BaseModel):
    kind: str
    extensions: list[str]
    description: str


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    project_id: UUID
    version_id: UUID
    original_filename: str
    mime_type: str | None
    file_size: int
    checksum: str | None
    detected_type: str | None
    status: str
    extraction_status: str
    extraction_metadata: dict | None
    created_at: datetime


class UploadItemResponse(BaseModel):
    filename: str
    accepted: bool
    file: FileResponse | None = None
    error: str | None = None


class UploadResponse(BaseModel):
    project_id: UUID
    version_id: UUID
    files: list[UploadItemResponse]
