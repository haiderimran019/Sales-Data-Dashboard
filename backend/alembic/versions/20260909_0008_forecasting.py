"""Add deterministic forecast artifacts.

Revision ID: 20260909_0008
Revises: 20260909_0007
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260909_0008"
down_revision: Union[str, None] = "20260909_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "forecast_artifacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=False),
        sa.Column("date_column", sa.String(length=255), nullable=False),
        sa.Column("measure_column", sa.String(length=255), nullable=False),
        sa.Column("frequency", sa.String(length=20), nullable=False),
        sa.Column("historical_observation_count", sa.Integer(), nullable=False),
        sa.Column("forecast_horizon", sa.Integer(), nullable=False),
        sa.Column("historical_values", sa.JSON(), nullable=False),
        sa.Column("forecast_values", sa.JSON(), nullable=False),
        sa.Column("lower_bound", sa.JSON(), nullable=False),
        sa.Column("upper_bound", sa.JSON(), nullable=False),
        sa.Column("method", sa.String(length=40), nullable=False),
        sa.Column("mae", sa.Float(), nullable=True),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("result_scope", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_forecast_artifacts_organization_id", "forecast_artifacts", ["organization_id"])
    op.create_index("ix_forecast_artifacts_version_id", "forecast_artifacts", ["version_id"])


def downgrade() -> None:
    op.drop_index("ix_forecast_artifacts_version_id", table_name="forecast_artifacts")
    op.drop_index("ix_forecast_artifacts_organization_id", table_name="forecast_artifacts")
    op.drop_table("forecast_artifacts")
