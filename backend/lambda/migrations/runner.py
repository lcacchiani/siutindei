"""Migration execution helpers."""

from __future__ import annotations

from alembic import command
from alembic.config import Config

from .utils import _escape_config


def _run_migrations(database_url: str) -> None:
    """Run Alembic migrations to the latest head."""
    config = Config()
    config.set_main_option("script_location", "/var/task/db/alembic")
    config.set_main_option("sqlalchemy.url", _escape_config(database_url))
    command.upgrade(config, "head")
