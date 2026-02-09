"""Secrets helpers for migrations Lambda."""

from __future__ import annotations

from typing import Any

from app.services.secrets import get_secret_json


def _load_db_user_secret(secret_arn: str) -> tuple[str, str]:
    """Load database user credentials from Secrets Manager."""
    payload = get_secret_json(secret_arn)
    username = payload.get("username") or payload.get("user")
    password = payload.get("password")
    if not username or not password:
        raise RuntimeError("Secret is missing database username or password")
    return str(username), str(password)


def _validate_db_username(username: str, allowed_users: set[str]) -> None:
    """Ensure proxy users match expected roles."""
    if username not in allowed_users:
        raise RuntimeError(f"Unexpected database user: {username}")


def _get_secret(secret_arn: str) -> dict[str, Any]:
    """Backward-compatible secret loader (used by other helpers)."""
    return get_secret_json(secret_arn)
