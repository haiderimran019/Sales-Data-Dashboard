from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, organization_ids_for_user
from app.models import OrganizationMember, Project, ProjectVersion, User
from app.schemas.history import HistoryResponse, ProjectCreate, ProjectResponse, VersionResponse

router = APIRouter(prefix="/api", tags=["history"])


def scoped_project_query(user: User, db: Session):
    organization_ids = organization_ids_for_user(user, db)
    return select(Project).where(Project.organization_id.in_(organization_ids))


def get_scoped_project(project_id: UUID, user: User, db: Session) -> Project:
    project = db.scalar(scoped_project_query(user, db).where(Project.id == project_id))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Project]:
    return list(db.scalars(scoped_project_query(user, db).order_by(Project.created_at.desc()).offset(offset).limit(limit)))


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    organization_id = db.scalar(
        select(OrganizationMember.organization_id)
        .where(OrganizationMember.user_id == user.id)
        .order_by(OrganizationMember.created_at)
        .limit(1)
    )
    if organization_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No organization membership")
    slug = "-".join(payload.name.lower().split())[:100]
    existing = db.scalar(select(Project).where(Project.organization_id == organization_id, Project.slug == slug))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project name already exists")
    project = Project(name=payload.name, slug=slug, organization_id=organization_id, created_by_user_id=user.id)
    db.add(project)
    db.flush()
    db.add(ProjectVersion(organization_id=organization_id, project_id=project.id, version_number=1))
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Project:
    return get_scoped_project(project_id, user, db)


@router.get("/projects/{project_id}/versions", response_model=list[VersionResponse])
def list_versions(project_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProjectVersion]:
    project = get_scoped_project(project_id, user, db)
    return list(db.scalars(select(ProjectVersion).where(ProjectVersion.project_id == project.id).order_by(ProjectVersion.version_number)))


@router.get("/analytics/history", response_model=list[ProjectResponse])
def analytics_history(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Project]:
    return list(db.scalars(scoped_project_query(user, db).order_by(Project.updated_at.desc()).offset(offset).limit(limit)))


@router.get("/analytics/history/{project_id}", response_model=HistoryResponse)
def analytics_project_history(project_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> HistoryResponse:
    project = get_scoped_project(project_id, user, db)
    versions = list(db.scalars(select(ProjectVersion).where(ProjectVersion.project_id == project.id).order_by(ProjectVersion.version_number)))
    return HistoryResponse(project=project, versions=versions)
