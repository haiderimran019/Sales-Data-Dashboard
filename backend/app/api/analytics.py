from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, organization_ids_for_user
from app.api.ingestion import get_scoped_version
from app.models import AnalysisResult, AnalysisRun, Dataset, DatasetColumn, File, RelationshipCandidate, User
from app.schemas.analytics import AnalysisPlanResponse, AnalysisRunResponse, AnalysisResultResponse
from app.services.analytics.executor import execute_plan
from app.services.analytics.planner import build_plan

router = APIRouter(prefix="/api", tags=["analytics"])


def _datasets_for_version(version_id: UUID, user: User, db: Session) -> list[Dataset]:
    return list(db.scalars(select(Dataset).where(Dataset.version_id == version_id, Dataset.organization_id.in_(organization_ids_for_user(user, db))).order_by(Dataset.created_at)))


def _planning_inputs(datasets: list[Dataset], db: Session) -> list[dict]:
    output = []
    for dataset in datasets:
        columns = list(db.scalars(select(DatasetColumn).where(DatasetColumn.dataset_id == dataset.id).order_by(DatasetColumn.created_at)))
        output.append({"id": str(dataset.id), "name": dataset.name, "domain": dataset.domain, "profile_scope": dataset.profile_scope, "columns": [{"original_name": column.original_name, "normalized_name": column.normalized_name, "inferred_type": column.inferred_type, "semantic_type": column.semantic_type, "confidence": column.confidence} for column in columns]})
    return output


def _execution_inputs(datasets: list[Dataset], db: Session) -> dict[str, dict]:
    output: dict[str, dict] = {}
    for dataset in datasets:
        file = db.get(File, dataset.file_id)
        tables = (file.extraction_metadata or {}).get("tables", []) if file else []
        table = next((table for table in tables if table.get("name") == dataset.name), tables[0] if tables else {})
        output[str(dataset.id)] = {"id": str(dataset.id), "name": dataset.name, "rows": table.get("rows", []), "row_count": dataset.row_count, "profile_scope": dataset.profile_scope}
    return output


def _scoped_run(run_id: UUID, user: User, db: Session) -> AnalysisRun:
    run = db.scalar(select(AnalysisRun).where(AnalysisRun.id == run_id, AnalysisRun.organization_id.in_(organization_ids_for_user(user, db))))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis run not found")
    return run


@router.post("/projects/{project_id}/versions/{version_id}/analyze", response_model=AnalysisRunResponse, status_code=status.HTTP_201_CREATED)
def analyze_version(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AnalysisRun:
    version = get_scoped_version(project_id, version_id, user, db)
    datasets = _datasets_for_version(version.id, user, db)
    if not datasets:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No profiled datasets are available for analysis")
    planning_inputs = _planning_inputs(datasets, db)
    relationships = list(db.scalars(select(RelationshipCandidate).where(RelationshipCandidate.version_id == version.id, RelationshipCandidate.organization_id.in_(organization_ids_for_user(user, db)))))
    plan = build_plan(planning_inputs, [{"id": str(relationship.id)} for relationship in relationships])
    results = execute_plan(plan, _execution_inputs(datasets, db))
    run = AnalysisRun(organization_id=version.organization_id, project_id=version.project_id, version_id=version.id, status="completed", plan=plan)
    db.add(run)
    db.flush()
    for result in results:
        db.add(AnalysisResult(organization_id=version.organization_id, project_id=version.project_id, version_id=version.id, dataset_id=UUID(result.dataset_id), run_id=run.id, analysis_type=result.analysis_type, title=result.title, description=result.description, status=result.status, calculation=result.calculation, inputs=result.inputs, result_data=result.result_data, units=result.units, result_scope=result.result_scope, warnings=result.warnings))
    db.commit()
    db.refresh(run)
    return run


@router.get("/projects/{project_id}/versions/{version_id}/analysis-plan", response_model=AnalysisPlanResponse)
def get_analysis_plan(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    version = get_scoped_version(project_id, version_id, user, db)
    datasets = _datasets_for_version(version.id, user, db)
    relationships = list(db.scalars(select(RelationshipCandidate).where(RelationshipCandidate.version_id == version.id, RelationshipCandidate.organization_id.in_(organization_ids_for_user(user, db)))))
    return build_plan(_planning_inputs(datasets, db), [{"id": str(relationship.id)} for relationship in relationships])


@router.get("/projects/{project_id}/versions/{version_id}/analyses", response_model=list[AnalysisRunResponse])
def list_analyses(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AnalysisRun]:
    version = get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(select(AnalysisRun).where(AnalysisRun.version_id == version.id, AnalysisRun.organization_id.in_(organization_ids_for_user(user, db))).order_by(AnalysisRun.created_at.desc())))


@router.get("/analyses/{analysis_id}", response_model=AnalysisResultResponse)
def get_analysis(analysis_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AnalysisResult:
    result = db.scalar(select(AnalysisResult).where(AnalysisResult.id == analysis_id, AnalysisResult.organization_id.in_(organization_ids_for_user(user, db))))
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis result not found")
    return result


@router.get("/projects/{project_id}/versions/{version_id}/metrics", response_model=list[AnalysisResultResponse])
def list_metrics(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AnalysisResult]:
    version = get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(select(AnalysisResult).where(AnalysisResult.version_id == version.id, AnalysisResult.organization_id.in_(organization_ids_for_user(user, db))).order_by(AnalysisResult.created_at.desc()).limit(100)))
