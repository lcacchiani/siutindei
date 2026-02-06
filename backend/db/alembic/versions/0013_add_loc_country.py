"""Add country column to locations table.

Adds a mandatory `country` column with a server default of 'Hong Kong'.
Existing rows are backfilled with the default value.
"""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013_add_loc_country"
down_revision: Union[str, None] = "0012_unify_tickets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add country column to locations."""

    # Add the column with a server default so existing rows are backfilled.
    op.add_column(
        "locations",
        sa.Column(
            "country",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'Hong Kong'"),
            comment="Country where the location is situated",
        ),
    )


def downgrade() -> None:
    """Remove country column from locations."""

    op.drop_column("locations", "country")
