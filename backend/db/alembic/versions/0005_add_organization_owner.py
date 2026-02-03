"""Add owner_id column to organizations for Cognito user ownership."""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_add_organization_owner"
down_revision: Union[str, None] = "0004_add_organization_pictures"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add owner_id column to organizations table.

    The owner_id references a Cognito user's sub (subject) identifier.
    This is stored as TEXT since Cognito subs are UUID strings.
    The column is nullable to support existing organizations without owners.
    """
    op.add_column(
        "organizations",
        sa.Column(
            "owner_id",
            sa.Text(),
            nullable=True,
            comment="Cognito user sub (subject) identifier of the organization owner",
        ),
    )
    # Create an index for efficient lookups by owner
    op.create_index(
        "organizations_owner_id_idx",
        "organizations",
        ["owner_id"],
    )


def downgrade() -> None:
    """Remove owner_id column from organizations."""
    op.drop_index("organizations_owner_id_idx", table_name="organizations")
    op.drop_column("organizations", "owner_id")
