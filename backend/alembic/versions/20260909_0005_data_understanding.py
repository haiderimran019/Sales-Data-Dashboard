"""Add deterministic data understanding tables.

Revision ID: 20260909_0005
Revises: 20260909_0004
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260909_0005"
down_revision: Union[str, None] = "20260909_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("dataset_type", sa.String(length=30), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("column_count", sa.Integer(), nullable=False),
        sa.Column("profile_scope", sa.String(length=30), nullable=False),
        sa.Column("quality_score", sa.Float(), nullable=True),
        sa.Column("quality_details", sa.JSON(), nullable=True),
        sa.Column("domain", sa.String(length=50), nullable=False),
        sa.Column("domain_confidence", sa.Float(), nullable=False),
        sa.Column("domain_evidence", sa.JSON(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_datasets_organization_id", "datasets", ["organization_id"])
    op.create_index("ix_datasets_version_id", "datasets", ["version_id"])
    op.create_table(
        "dataset_columns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("inferred_type", sa.String(length=30), nullable=False),
        sa.Column("semantic_type", sa.String(length=40), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("null_count", sa.Integer(), nullable=False),
        sa.Column("null_percentage", sa.Float(), nullable=False),
        sa.Column("unique_count", sa.Integer(), nullable=False),
        sa.Column("uniqueness_percentage", sa.Float(), nullable=False),
        sa.Column("sample_values", sa.JSON(), nullable=True),
        sa.Column("statistics", sa.JSON(), nullable=True),
        sa.Column("top_values", sa.JSON(), nullable=True),
        sa.Column("outlier_count", sa.Integer(), nullable=False),
        sa.Column("outlier_percentage", sa.Float(), nullable=False),
        sa.Column("outlier_method", sa.String(length=30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dataset_id", "normalized_name", name="uq_dataset_column_normalized_name"),
    )
    op.create_index("ix_dataset_columns_dataset_id", "dataset_columns", ["dataset_id"])
    op.create_table(
        "relationship_candidates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("left_dataset_id", sa.Uuid(), nullable=False),
        sa.Column("left_column_id", sa.Uuid(), nullable=False),
        sa.Column("right_dataset_id", sa.Uuid(), nullable=False),
        sa.Column("right_column_id", sa.Uuid(), nullable=False),
        sa.Column("relationship_type", sa.String(length=30), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["left_dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["left_column_id"], ["dataset_columns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["right_dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["right_column_id"], ["dataset_columns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_relationship_candidates_organization_id", "relationship_candidates", ["organization_id"])
    op.create_index("ix_relationship_candidates_version_id", "relationship_candidates", ["version_id"])
    op.create_table(
        "analysis_opportunities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analysis_opportunities_organization_id", "analysis_opportunities", ["organization_id"])
    op.create_index("ix_analysis_opportunities_version_id", "analysis_opportunities", ["version_id"])


def downgrade() -> None:
    op.drop_index("ix_analysis_opportunities_version_id", table_name="analysis_opportunities")
    op.drop_index("ix_analysis_opportunities_organization_id", table_name="analysis_opportunities")
    op.drop_table("analysis_opportunities")
    op.drop_index("ix_relationship_candidates_version_id", table_name="relationship_candidates")
    op.drop_index("ix_relationship_candidates_organization_id", table_name="relationship_candidates")
    op.drop_table("relationship_candidates")
    op.drop_index("ix_dataset_columns_dataset_id", table_name="dataset_columns")
    op.drop_table("dataset_columns")
    op.drop_index("ix_datasets_version_id", table_name="datasets")
    op.drop_index("ix_datasets_organization_id", table_name="datasets")
    op.drop_table("datasets")
