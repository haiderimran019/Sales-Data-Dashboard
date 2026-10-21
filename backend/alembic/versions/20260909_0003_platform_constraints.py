"""Add platform role and version constraints.

Revision ID: 20260909_0003
Revises: 20260909_0002
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260909_0003"
down_revision: Union[str, None] = "20260909_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_organization_member_role",
        "organization_members",
        "role IN ('owner', 'admin', 'member')",
    )
    op.create_check_constraint(
        "ck_project_version_positive",
        "project_versions",
        "version_number > 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_project_version_positive", "project_versions", type_="check")
    op.drop_constraint("ck_organization_member_role", "organization_members", type_="check")
