"""Add deterministic analytics artifacts.

Revision ID: 20260909_0006
Revises: 20260909_0005
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260909_0006"
down_revision: Union[str, None] = "20260909_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analysis_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("plan", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analysis_runs_organization_id", "analysis_runs", ["organization_id"])
    op.create_index("ix_analysis_runs_version_id", "analysis_runs", ["version_id"])
    op.create_table(
        "analysis_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=True),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("analysis_type", sa.String(length=60), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("calculation", sa.JSON(), nullable=False),
        sa.Column("inputs", sa.JSON(), nullable=False),
        sa.Column("result_data", sa.JSON(), nullable=True),
        sa.Column("units", sa.String(length=50), nullable=True),
        sa.Column("result_scope", sa.String(length=30), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["analysis_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analysis_results_organization_id", "analysis_results", ["organization_id"])
    op.create_index("ix_analysis_results_version_id", "analysis_results", ["version_id"])
    op.create_index("ix_analysis_results_run_id", "analysis_results", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_analysis_results_run_id", table_name="analysis_results")
    op.drop_index("ix_analysis_results_version_id", table_name="analysis_results")
    op.drop_index("ix_analysis_results_organization_id", table_name="analysis_results")
    op.drop_table("analysis_results")
    op.drop_index("ix_analysis_runs_version_id", table_name="analysis_runs")
    op.drop_index("ix_analysis_runs_organization_id", table_name="analysis_runs")
    op.drop_table("analysis_runs")
