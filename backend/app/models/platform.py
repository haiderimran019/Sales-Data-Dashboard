from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ProcessingStatus(StrEnum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    projects: Mapped[list["Project"]] = relationship(back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    display_name: Mapped[str | None] = mapped_column(String(200))
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_organization_member"),
        CheckConstraint("role IN ('owner', 'admin', 'member')", name="ck_organization_member_role"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_project_organization_slug"),
        Index("ix_projects_organization_id", "organization_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="projects")
    versions: Mapped[list["ProjectVersion"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectVersion(Base):
    __tablename__ = "project_versions"
    __table_args__ = (
        UniqueConstraint("project_id", "version_number", name="uq_project_version_number"),
        CheckConstraint("version_number > 0", name="ck_project_version_positive"),
        Index("ix_project_versions_organization_id", "organization_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_number: Mapped[int] = mapped_column(nullable=False)
    label: Mapped[str | None] = mapped_column(String(200))
    configuration: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    processing_status: Mapped[str] = mapped_column(String(50), nullable=False, default="not_started")
    source_file_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    project: Mapped[Project] = relationship(back_populates="versions")
    files: Mapped[list["File"]] = relationship(back_populates="version", cascade="all, delete-orphan")
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(back_populates="version")


class File(Base):
    __tablename__ = "files"
    __table_args__ = (
        Index("ix_files_organization_id", "organization_id"),
        Index("ix_files_version_id", "version_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[UUID] = mapped_column(ForeignKey("project_versions.id", ondelete="CASCADE"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    mime_type: Mapped[str | None] = mapped_column(String(150))
    file_size: Mapped[int] = mapped_column(nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128))
    detected_type: Mapped[str | None] = mapped_column(String(30))
    extraction_status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued")
    extraction_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="uploaded")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    version: Mapped[ProjectVersion] = relationship(back_populates="files")
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(back_populates="file")
    datasets: Mapped[list["Dataset"]] = relationship(back_populates="file", cascade="all, delete-orphan")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    __table_args__ = (
        Index("ix_processing_jobs_organization_id", "organization_id"),
        Index("ix_processing_jobs_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[UUID] = mapped_column(ForeignKey("project_versions.id", ondelete="CASCADE"), nullable=False)
    file_id: Mapped[UUID | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    job_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=ProcessingStatus.pending.value)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    version: Mapped[ProjectVersion] = relationship(back_populates="processing_jobs")
    file: Mapped[File | None] = relationship(back_populates="processing_jobs")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_organization_id_created_at", "organization_id", "created_at"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[UUID | None] = mapped_column(Uuid)
    audit_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped[User | None] = relationship(back_populates="audit_logs")


class Dataset(Base):
    __tablename__ = "datasets"
    __table_args__ = (
        Index("ix_datasets_organization_id", "organization_id"),
        Index("ix_datasets_version_id", "version_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[UUID] = mapped_column(ForeignKey("project_versions.id", ondelete="CASCADE"), nullable=False)
    file_id: Mapped[UUID] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_type: Mapped[str] = mapped_column(String(30), nullable=False)
    row_count: Mapped[int | None] = mapped_column()
    column_count: Mapped[int] = mapped_column(nullable=False, default=0)
    profile_scope: Mapped[str] = mapped_column(String(30), nullable=False, default="exact")
    quality_score: Mapped[float | None] = mapped_column()
    quality_details: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    domain: Mapped[str] = mapped_column(String(50), nullable=False, default="General/Unknown")
    domain_confidence: Mapped[float] = mapped_column(default=0.0, nullable=False)
    domain_evidence: Mapped[list[str] | None] = mapped_column(JSON)
    dataset_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    file: Mapped[File] = relationship(back_populates="datasets")
    columns: Mapped[list["DatasetColumn"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class DatasetColumn(Base):
    __tablename__ = "dataset_columns"
    __table_args__ = (
        Index("ix_dataset_columns_dataset_id", "dataset_id"),
        UniqueConstraint("dataset_id", "normalized_name", name="uq_dataset_column_normalized_name"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    dataset_id: Mapped[UUID] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    inferred_type: Mapped[str] = mapped_column(String(30), nullable=False)
    semantic_type: Mapped[str] = mapped_column(String(40), nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=False, default=0.0)
    evidence: Mapped[list[str] | None] = mapped_column(JSON)
    null_count: Mapped[int] = mapped_column(nullable=False, default=0)
    null_percentage: Mapped[float] = mapped_column(nullable=False, default=0.0)
    unique_count: Mapped[int] = mapped_column(nullable=False, default=0)
    uniqueness_percentage: Mapped[float] = mapped_column(nullable=False, default=0.0)
    sample_values: Mapped[list[Any] | None] = mapped_column(JSON)
    statistics: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    top_values: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    outlier_count: Mapped[int] = mapped_column(nullable=False, default=0)
    outlier_percentage: Mapped[float] = mapped_column(nullable=False, default=0.0)
    outlier_method: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    dataset: Mapped[Dataset] = relationship(back_populates="columns")


class RelationshipCandidate(Base):
    __tablename__ = "relationship_candidates"
    __table_args__ = (
        Index("ix_relationship_candidates_organization_id", "organization_id"),
        Index("ix_relationship_candidates_version_id", "version_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[UUID] = mapped_column(ForeignKey("project_versions.id", ondelete="CASCADE"), nullable=False)
    left_dataset_id: Mapped[UUID] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    left_column_id: Mapped[UUID] = mapped_column(ForeignKey("dataset_columns.id", ondelete="CASCADE"), nullable=False)
    right_dataset_id: Mapped[UUID] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    right_column_id: Mapped[UUID] = mapped_column(ForeignKey("dataset_columns.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(30), nullable=False, default="unknown")
    confidence: Mapped[float] = mapped_column(nullable=False, default=0.0)
    evidence: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class AnalysisOpportunity(Base):
    __tablename__ = "analysis_opportunities"
    __table_args__ = (
        Index("ix_analysis_opportunities_organization_id", "organization_id"),
        Index("ix_analysis_opportunities_version_id", "version_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[UUID] = mapped_column(ForeignKey("project_versions.id", ondelete="CASCADE"), nullable=False)
    dataset_id: Mapped[UUID | None] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[list[str] | None] = mapped_column(JSON)
    confidence: Mapped[float] = mapped_column(nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    __table_args__ = (
        Index("ix_analysis_runs_organization_id", "organization_id"),
        Index("ix_analysis_runs_version_id", "version_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[UUID] = mapped_column(ForeignKey("project_versions.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="completed")
    plan: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    results: Mapped[list["AnalysisResult"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    __table_args__ = (
        Index("ix_analysis_results_organization_id", "organization_id"),
        Index("ix_analysis_results_version_id", "version_id"),
        Index("ix_analysis_results_run_id", "run_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[UUID] = mapped_column(ForeignKey("project_versions.id", ondelete="CASCADE"), nullable=False)
    dataset_id: Mapped[UUID | None] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"))
    run_id: Mapped[UUID] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(60), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="completed")
    calculation: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    inputs: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    result_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    units: Mapped[str | None] = mapped_column(String(50))
    result_scope: Mapped[str] = mapped_column(String(30), nullable=False, default="exact")
    warnings: Mapped[list[str] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    run: Mapped[AnalysisRun] = relationship(back_populates="results")
