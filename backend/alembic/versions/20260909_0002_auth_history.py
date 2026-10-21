"""Add Google identity and project history metadata.

Revision ID: 20260909_0002
Revises: 20260909_0001
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260909_0002"
down_revision: Union[str, None] = "20260909_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_subject", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("profile_image_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_google_subject", "users", ["google_subject"], unique=True)
    op.add_column("projects", sa.Column("created_by_user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_projects_created_by_user", "projects", "users", ["created_by_user_id"], ["id"], ondelete="SET NULL")
    op.add_column("project_versions", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column("project_versions", sa.Column("processing_status", sa.String(length=50), server_default="not_started", nullable=False))
    op.add_column("project_versions", sa.Column("source_file_metadata", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("project_versions", "source_file_metadata")
    op.drop_column("project_versions", "processing_status")
    op.drop_column("project_versions", "updated_at")
    op.drop_constraint("fk_projects_created_by_user", "projects", type_="foreignkey")
    op.drop_column("projects", "created_by_user_id")
    op.drop_index("ix_users_google_subject", table_name="users")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "profile_image_url")
    op.drop_column("users", "google_subject")
