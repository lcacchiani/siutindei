"""Add ticket_id to organization_access_requests.

Each access request gets a unique progressive ticket ID in format R + 10 digits
for tracking and reference in email communications (e.g., R0000000001).
"""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_add_ticket_id_to_access_requests"
down_revision: Union[str, None] = "0007_add_organization_access_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ticket_id column to organization_access_requests."""
    # Add the ticket_id column
    op.add_column(
        "organization_access_requests",
        sa.Column(
            "ticket_id",
            sa.Text(),
            nullable=True,
            comment="Unique progressive ticket ID for tracking (format: R + 10 digits)",
        ),
    )

    # Create unique index on ticket_id
    op.create_index(
        "organization_access_requests_ticket_id_idx",
        "organization_access_requests",
        ["ticket_id"],
        unique=True,
    )

    # Generate progressive ticket IDs for existing rows
    connection = op.get_bind()
    result = connection.execute(
        sa.text(
            "SELECT id FROM organization_access_requests "
            "WHERE ticket_id IS NULL ORDER BY created_at"
        )
    )
    rows = result.fetchall()

    for idx, row in enumerate(rows, start=1):
        # Generate progressive ticket ID (R0000000001, R0000000002, etc.)
        ticket_id = f"R{idx:010d}"
        connection.execute(
            sa.text(
                "UPDATE organization_access_requests SET ticket_id = :ticket_id WHERE id = :id"
            ),
            {"ticket_id": ticket_id, "id": row[0]},
        )

    # Make the column NOT NULL after populating existing rows
    op.alter_column(
        "organization_access_requests",
        "ticket_id",
        nullable=False,
    )


def downgrade() -> None:
    """Remove ticket_id column."""
    op.drop_index(
        "organization_access_requests_ticket_id_idx",
        table_name="organization_access_requests",
    )
    op.drop_column("organization_access_requests", "ticket_id")
