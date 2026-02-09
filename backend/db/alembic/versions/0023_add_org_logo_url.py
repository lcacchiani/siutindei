"""Add organization logo media URL."""

from __future__ import annotations

from typing import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_add_org_logo_url"
down_revision: Union[str, None] = "0022_add_free_pricing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add logo_media_url to organizations."""
    op.add_column(
        "organizations",
        sa.Column("logo_media_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Drop logo_media_url from organizations."""
    op.drop_column("organizations", "logo_media_url")
