from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, get_db, organization_ids_for_user
from app.api.ingestion import get_scoped_version
from app.core.config import get_settings
from app.models import AIInsightRun, Project, ProjectVersion, User
from app.schemas.ai import AIInsightRunResponse
from app.services.ai.service import AIAnalystService

router = APIRouter(prefix="/api", tags=["ai-analyst"])


def scoped_project(project_id: UUID, user: User, db: Session) -> Project:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.organization_id.in_(organization_ids_for_user(user, db))))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def scoped_run(run_id: UUID, user: User, db: Session) -> AIInsightRun:
    run = db.scalar(select(AIInsightRun).options(selectinload(AIInsightRun.items)).where(AIInsightRun.id == run_id, AIInsightRun.organization_id.in_(organization_ids_for_user(user, db))))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI insight run not found")
    return run


@router.post("/projects/{project_id}/versions/{version_id}/ai-insights", response_model=AIInsightRunResponse, status_code=status.HTTP_201_CREATED)
def generate_ai_insights(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AIInsightRun:
    project = scoped_project(project_id, user, db)
    version = get_scoped_version(project_id, version_id, user, db)
    try:
        run, _ = AIAnalystService(get_settings()).generate(db, project=project, version=version)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The AI provider could not return a valid grounded response") from exc
    return scoped_run(run.id, user, db)


@router.get("/projects/{project_id}/versions/{version_id}/ai-insights", response_model=list[AIInsightRunResponse])
def list_ai_insights(project_id: UUID, version_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AIInsightRun]:
    version = get_scoped_version(project_id, version_id, user, db)
    return list(db.scalars(select(AIInsightRun).options(selectinload(AIInsightRun.items)).where(AIInsightRun.version_id == version.id, AIInsightRun.organization_id.in_(organization_ids_for_user(user, db))).order_by(AIInsightRun.created_at.desc()).limit(20)))


@router.get("/ai-insights/{run_id}", response_model=AIInsightRunResponse)
def get_ai_insights(run_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AIInsightRun:
    return scoped_run(run_id, user, db)
