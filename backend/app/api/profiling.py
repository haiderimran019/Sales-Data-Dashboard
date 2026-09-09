from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, organization_ids_for_user
from app.api.ingestion import get_scoped_version
from app.models import AnalysisOpportunity, Dataset, DatasetColumn, RelationshipCandidate, User
from app.schemas.profiling import DatasetColumnResponse, DatasetResponse, OpportunityResponse, RelationshipResponse, VersionProfileResponse

router = APIRouter(prefix="/api", tags=["understanding"])


def scoped_datasets(version_id: UUID, user: User, db: Session):
    return select(Dataset).where(Dataset.version_id == version_id, Dataset.organization_id.in_(organization_ids_for_user(user, db)))


def get_scoped_dataset(dataset_id: UUID, user: User, db: Session) -> Dataset:
    dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id, Dataset.organization_id.in_(organization_ids_for_user(user, db))))
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


def version_profile(version_id: UUID, user: User, db: Session) -> VersionProfileResponse:
    datasets = list(db.scalars(scoped_datasets(version_id, user, db).order_by(Dataset.created_at)))
    dataset_ids = [dataset.id for dataset in datasets]
    columns = list(db.scalars(select(DatasetColumn).where(DatasetColumn.organization_id.in_(organization_ids_for_user(user, db)), DatasetColumn.dataset_id.in_(dataset_ids)).order_by(DatasetColumn.created_at))) if dataset_ids else []
    relationships = list(db.scalars(select(RelationshipCandidate).where(RelationshipCandidate.version_id == version_id, RelationshipCandidate.organization_id.in_(organization_ids_for_user(user, db)))))
    opportunities = list(db.scalars(select(AnalysisOpportunity).where(AnalysisOpportunity.version_id == version_id, AnalysisOpportunity.organization_id.in_(organization_ids_for_user(user, db)))))
    return VersionProfileResponse(datasets=datasets, columns=columns, relationships=relationships, opportunities=opportunities)


@router.get("/projects/{project_id}/versions/{version_id}/profile", response_model=VersionProfileResponse)
def get_version_profile(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> VersionProfileResponse:
    get_scoped_version(project_id, version_id, user, db)
    return version_profile(version_id, user, db)


@router.get("/projects/{project_id}/versions/{version_id}/datasets", response_model=list[DatasetResponse])
def list_datasets(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Dataset]:
    get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(scoped_datasets(version_id, user, db).order_by(Dataset.created_at)))


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Dataset:
    return get_scoped_dataset(dataset_id, user, db)


@router.get("/datasets/{dataset_id}/columns", response_model=list[DatasetColumnResponse])
def list_dataset_columns(dataset_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[DatasetColumn]:
    dataset = get_scoped_dataset(dataset_id, user, db)
    return list(db.scalars(select(DatasetColumn).where(DatasetColumn.dataset_id == dataset.id).order_by(DatasetColumn.created_at)))


@router.get("/projects/{project_id}/versions/{version_id}/relationships", response_model=list[RelationshipResponse])
def list_relationships(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[RelationshipCandidate]:
    get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(select(RelationshipCandidate).where(RelationshipCandidate.version_id == version_id, RelationshipCandidate.organization_id.in_(organization_ids_for_user(user, db)))))


@router.get("/projects/{project_id}/versions/{version_id}/opportunities", response_model=list[OpportunityResponse])
def list_opportunities(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AnalysisOpportunity]:
    get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(select(AnalysisOpportunity).where(AnalysisOpportunity.version_id == version_id, AnalysisOpportunity.organization_id.in_(organization_ids_for_user(user, db)))))
