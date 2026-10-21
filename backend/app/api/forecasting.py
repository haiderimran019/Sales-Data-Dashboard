from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, organization_ids_for_user
from app.api.ingestion import get_scoped_version
from app.models import Dataset, File, ForecastArtifact, Project, User
from app.schemas.forecasting import ForecastResponse
from app.services.forecasting.service import ForecastUnavailable, forecast_series

router = APIRouter(prefix="/api", tags=["forecasting"])


def scoped_project(project_id: UUID, user: User, db: Session) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.organization_id.in_(organization_ids_for_user(user, db))))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def scoped_forecast(forecast_id: UUID, user: User, db: Session) -> ForecastArtifact:
    artifact = db.scalar(select(ForecastArtifact).where(ForecastArtifact.id == forecast_id, ForecastArtifact.organization_id.in_(organization_ids_for_user(user, db))))
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Forecast not found")
    return artifact


def dataset_rows(dataset: Dataset, db: Session) -> dict:
    file = db.get(File, dataset.file_id)
    tables = (file.extraction_metadata or {}).get("tables", []) if file else []
    table = next((table for table in tables if table.get("name") == dataset.name), tables[0] if tables else {})
    return {"rows": table.get("rows", []), "row_count": dataset.row_count, "profile_scope": dataset.profile_scope}


@router.post("/projects/{project_id}/versions/{version_id}/forecasts", response_model=ForecastResponse, status_code=status.HTTP_201_CREATED)
def create_forecast(project_id: UUID, version_id: UUID, dataset_id: UUID, date_column: str, measure_column: str, horizon: int = Query(default=6, ge=1, le=12), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ForecastArtifact:
    version = get_scoped_version(project_id, version_id, user, db)
    dataset = db.scalar(select(Dataset).where(Dataset.id == dataset_id, Dataset.version_id == version.id, Dataset.organization_id.in_(organization_ids_for_user(user, db))))
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    try:
        result = forecast_series(**dataset_rows(dataset, db), date_column=date_column, measure_column=measure_column, horizon=horizon, result_scope="estimated" if dataset.profile_scope == "preview" else "exact")
    except ForecastUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    artifact = ForecastArtifact(organization_id=version.organization_id, project_id=version.project_id, version_id=version.id, dataset_id=dataset.id, date_column=result.date_column, measure_column=result.measure_column, frequency=result.frequency, historical_observation_count=result.historical_observation_count, forecast_horizon=result.forecast_horizon, historical_values=result.historical_values, forecast_values=result.forecast_values, lower_bound=result.lower_bound, upper_bound=result.upper_bound, method=result.method, mae=result.mae, warnings=result.warnings, result_scope=result.result_scope)
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return artifact


@router.get("/projects/{project_id}/versions/{version_id}/forecasts", response_model=list[ForecastResponse])
def list_forecasts(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ForecastArtifact]:
    version = get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(select(ForecastArtifact).where(ForecastArtifact.version_id == version.id, ForecastArtifact.organization_id.in_(organization_ids_for_user(user, db))).order_by(ForecastArtifact.created_at.desc()).limit(20)))


@router.get("/forecasts/{forecast_id}", response_model=ForecastResponse)
def get_forecast(forecast_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ForecastArtifact:
    return scoped_forecast(forecast_id, user, db)
