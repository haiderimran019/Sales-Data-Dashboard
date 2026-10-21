import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File as UploadFileField, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, organization_ids_for_user
from app.api.history import get_scoped_project
from app.core.config import get_settings
from app.models import File as StoredFile
from app.models import ProcessingJob, ProjectVersion, User
from app.schemas.ingestion import FileResponse, SupportedTypeResponse, UploadItemResponse, UploadResponse
from app.services.ingestion.detector import SUPPORTED_EXTENSIONS, detect_file
from app.services.ingestion.registry import extractor_registry
from app.services.ingestion.storage import LocalStorage
from app.services.profiling.profiler import profile_extraction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ingestion"])
settings = get_settings()
storage = LocalStorage(settings.local_storage_path)

SUPPORTED_DESCRIPTIONS = {
    "csv": "Comma-separated or delimited text data",
    "xlsx": "Excel workbook with preserved sheet boundaries",
    "pdf": "PDF text and document metadata",
    "docx": "Word paragraphs and tables",
    "pptx": "PowerPoint slide text and tables",
    "image": "PNG, JPEG, or WEBP image metadata; OCR pending",
}


def supported_types() -> list[SupportedTypeResponse]:
    extensions: dict[str, list[str]] = {}
    for extension, (kind, _) in SUPPORTED_EXTENSIONS.items():
        extensions.setdefault(kind, []).append(extension)
    return [SupportedTypeResponse(kind=kind, extensions=sorted(values), description=SUPPORTED_DESCRIPTIONS[kind]) for kind, values in sorted(extensions.items())]


def get_scoped_version(project_id: UUID, version_id: UUID, user: User, db: Session) -> ProjectVersion:
    project = get_scoped_project(project_id, user, db)
    version = db.scalar(select(ProjectVersion).where(ProjectVersion.id == version_id, ProjectVersion.project_id == project.id, ProjectVersion.organization_id == project.organization_id))
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project version not found")
    return version


def _safe_filename(filename: str | None) -> str:
    name = Path(filename or "").name
    if not name or name in {".", ".."} or "\\" in name:
        raise ValueError("A safe filename is required")
    return name


@router.get("/ingestion/supported-types", response_model=list[SupportedTypeResponse])
def get_supported_types(user: User = Depends(get_current_user)) -> list[SupportedTypeResponse]:
    return supported_types()


@router.post("/projects/{project_id}/versions/{version_id}/files", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
def upload_files(
    project_id: UUID,
    version_id: UUID,
    uploads: list[UploadFile] = UploadFileField(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    version = get_scoped_version(project_id, version_id, user, db)
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    results: list[UploadItemResponse] = []
    for upload in uploads:
        filename = upload.filename or "unnamed"
        storage_key: str | None = None
        try:
            safe_name = _safe_filename(upload.filename)
            extension = Path(safe_name).suffix.lower()
            if extension not in SUPPORTED_EXTENSIONS:
                raise ValueError("Unsupported file type")
            storage_key = storage.key_for(version.organization_id, version.id, extension)
            size, checksum = storage.save(upload.file, storage_key, max_bytes)
            path = storage.path_for(storage_key)
            detected = detect_file(path, safe_name, upload.content_type)
            existing = db.scalar(select(StoredFile).where(StoredFile.organization_id == version.organization_id, StoredFile.version_id == version.id, StoredFile.checksum == checksum))
            if existing:
                storage.delete(storage_key)
                results.append(UploadItemResponse(filename=safe_name, accepted=True, file=existing))
                continue
            extraction = extractor_registry.get(detected.kind).extract(path, detected, row_limit=settings.preview_row_limit, text_limit=settings.preview_text_limit)
            stored = StoredFile(
                organization_id=version.organization_id,
                project_id=version.project_id,
                version_id=version.id,
                original_filename=safe_name,
                storage_key=storage_key,
                mime_type=detected.mime_type,
                file_size=size,
                checksum=checksum,
                detected_type=detected.kind,
                status="completed",
                extraction_status=extraction.status,
                extraction_metadata=extraction.to_metadata(),
            )
            db.add(stored)
            db.flush()
            profile_extraction(db, organization_id=version.organization_id, project_id=version.project_id, version_id=version.id, file=stored, extraction=extraction.to_metadata())
            db.add(ProcessingJob(organization_id=version.organization_id, project_id=version.project_id, version_id=version.id, file_id=stored.id, job_type="ingestion", status="completed"))
            db.commit()
            db.refresh(stored)
            results.append(UploadItemResponse(filename=safe_name, accepted=True, file=stored))
        except (ValueError, OSError) as exc:
            if storage_key:
                storage.delete(storage_key)
            db.rollback()
            results.append(UploadItemResponse(filename=filename, accepted=False, error=str(exc)))
        except Exception:
            if storage_key:
                storage.delete(storage_key)
            db.rollback()
            logger.exception("Ingestion failed for one uploaded file")
            results.append(UploadItemResponse(filename=filename, accepted=False, error="The file could not be processed."))
    return UploadResponse(project_id=project_id, version_id=version_id, files=results)


@router.get("/projects/{project_id}/versions/{version_id}/files", response_model=list[FileResponse])
def list_files(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[StoredFile]:
    version = get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(select(StoredFile).where(StoredFile.organization_id == version.organization_id, StoredFile.project_id == project_id, StoredFile.version_id == version_id).order_by(StoredFile.created_at.desc())))


@router.get("/files/{file_id}", response_model=FileResponse)
def get_file(file_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StoredFile:
    stored = db.scalar(select(StoredFile).where(StoredFile.id == file_id, StoredFile.organization_id.in_(organization_ids_for_user(user, db))))
    if not stored:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return stored


@router.get("/files/{file_id}/extraction", response_model=dict)
def get_extraction(file_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    stored = get_file(file_id, user, db)
    return stored.extraction_metadata or {"status": stored.extraction_status}
