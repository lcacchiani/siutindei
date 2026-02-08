"""Add free pricing type."""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op

revision: str = "0022_add_free_pricing"
down_revision: Union[str, None] = "0021_update_pricing_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add free pricing type."""
    op.execute(
        "CREATE TYPE pricing_type_new AS ENUM "
        "('per_class', 'per_sessions', 'per_hour', 'per_day', 'free')"
    )
    op.execute(
        "ALTER TABLE activity_pricing "
        "ALTER COLUMN pricing_type TYPE pricing_type_new "
        "USING pricing_type::text::pricing_type_new"
    )
    op.execute("DROP TYPE pricing_type")
    op.execute("ALTER TYPE pricing_type_new RENAME TO pricing_type")


def downgrade() -> None:
    """Remove free pricing type."""
    op.execute(
        "DELETE FROM activity_pricing WHERE pricing_type = 'free'"
    )
    op.execute(
        "CREATE TYPE pricing_type_old AS ENUM "
        "('per_class', 'per_sessions', 'per_hour', 'per_day')"
    )
    op.execute(
        "ALTER TABLE activity_pricing "
        "ALTER COLUMN pricing_type TYPE pricing_type_old "
        "USING pricing_type::text::pricing_type_old"
    )
    op.execute("DROP TYPE pricing_type")
    op.execute("ALTER TYPE pricing_type_old RENAME TO pricing_type")
