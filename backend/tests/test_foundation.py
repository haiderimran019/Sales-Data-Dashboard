from app.core.config import Settings
from app.models import (
    AuditLog,
    File,
    Organization,
    OrganizationMember,
    ProcessingJob,
    Project,
    ProjectVersion,
    User,
)


def test_platform_models_import() -> None:
    assert {
        model.__tablename__
        for model in (Organization, User, OrganizationMember, Project, ProjectVersion, File, ProcessingJob, AuditLog)
    } == {
        "organizations",
        "users",
        "organization_members",
        "projects",
        "project_versions",
        "files",
        "processing_jobs",
        "audit_logs",
    }


def test_configuration_reads_environment(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://example/database")
    monkeypatch.setenv("SECRET_KEY", "test-only")

    settings = Settings()

    assert settings.database_url.endswith("/database")
    assert settings.secret_key == "test-only"
