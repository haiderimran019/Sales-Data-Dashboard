"""Add generic file detection and extraction metadata.

Revision ID: 20260909_0004
Revises: 20260909_0003
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260909_0004"
down_revision: Union[str, None] = "20260909_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("files", sa.Column("detected_type", sa.String(length=30), nullable=True))
    op.add_column("files", sa.Column("extraction_status", sa.String(length=30), server_default="queued", nullable=False))
    op.add_column("files", sa.Column("extraction_metadata", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("files", "extraction_metadata")
    op.drop_column("files", "extraction_status")
    op.drop_column("files", "detected_type")
