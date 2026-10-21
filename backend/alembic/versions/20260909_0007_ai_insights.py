"""Add persisted AI analyst insight artifacts.

Revision ID: 20260909_0007
Revises: 20260909_0006
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260909_0007"
down_revision: Union[str, None] = "20260909_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_insight_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("context_metadata", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_insight_runs_organization_id", "ai_insight_runs", ["organization_id"])
    op.create_index("ix_ai_insight_runs_version_id", "ai_insight_runs", ["version_id"])
    op.create_table(
        "ai_insight_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("item_type", sa.String(length=30), nullable=False),
        sa.Column("classification", sa.String(length=30), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("priority_score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["ai_insight_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_insight_items_organization_id", "ai_insight_items", ["organization_id"])
    op.create_index("ix_ai_insight_items_run_id", "ai_insight_items", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_insight_items_run_id", table_name="ai_insight_items")
    op.drop_index("ix_ai_insight_items_organization_id", table_name="ai_insight_items")
    op.drop_table("ai_insight_items")
    op.drop_index("ix_ai_insight_runs_version_id", table_name="ai_insight_runs")
    op.drop_index("ix_ai_insight_runs_organization_id", table_name="ai_insight_runs")
    op.drop_table("ai_insight_runs")
