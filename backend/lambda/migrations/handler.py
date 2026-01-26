"""Lambda handler to run Alembic migrations and seed data."""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any
from typing import Mapping

import psycopg
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from app.db.connection import get_database_url


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle CloudFormation custom resource events for migrations."""

    request_type = event.get("RequestType")
    if request_type == "Delete":
        return {"PhysicalResourceId": "migrations", "Data": {"status": "skipped"}}

    database_url = get_database_url()
    _run_with_retry(_run_migrations, database_url)

    run_seed = _truthy(event.get("ResourceProperties", {}).get("RunSeed"))
    if run_seed:
        seed_path = os.getenv("SEED_FILE_PATH", "/var/task/db/seed/seed_data.sql")
        _run_with_retry(_run_seed, database_url, seed_path)

    return {"PhysicalResourceId": "migrations", "Data": {"status": "ok"}}


def _run_migrations(database_url: str) -> None:
    """Run Alembic migrations to the latest head."""

    config = Config()
    config.set_main_option("script_location", "/var/task/db/alembic")
    config.set_main_option("sqlalchemy.url", _escape_config(database_url))
    command.upgrade(config, "head")


def _run_seed(database_url: str, seed_path: str) -> None:
    """Run seed SQL if the file exists."""

    path = Path(seed_path)
    if not path.exists():
        return

    sql = path.read_text(encoding="utf-8")
    if not sql.strip():
        return

    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
        connection.commit()


def _run_with_retry(func: Any, *args: Any) -> None:
    """Retry migration operations to wait for DB readiness."""

    delay = 1.0
    last_error: Exception | None = None
    for _ in range(5):
        try:
            func(*args)
            return
        except Exception as exc:  # pragma: no cover - best effort retry
            last_error = exc
            time.sleep(delay)
            delay *= 2
    if last_error:
        raise last_error


def _escape_config(value: str) -> str:
    """Escape percent signs for configparser interpolation."""

    return value.replace("%", "%%")


def _psycopg_connect(database_url: str) -> psycopg.Connection:
    """Connect using keyword args to avoid DSN parsing issues."""

    try:
        url = make_url(database_url)
    except Exception:
        url = make_url(f"postgresql://{database_url}")

    connect_kwargs: dict[str, Any] = {
        "user": url.username,
        "password": url.password,
        "host": url.host,
        "port": url.port,
        "dbname": url.database,
    }
    sslmode = url.query.get("sslmode")
    if sslmode:
        connect_kwargs["sslmode"] = sslmode

    return psycopg.connect(**{k: v for k, v in connect_kwargs.items() if v is not None})


def _truthy(value: Any) -> bool:
    """Return True for common truthy values."""

    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "y"}
