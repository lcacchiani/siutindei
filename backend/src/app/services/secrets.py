"""Secrets Manager helpers with caching."""

from __future__ import annotations

import base64
import json
from typing import Any

from app.services.aws_clients import get_secretsmanager_client

_SECRET_CACHE: dict[str, dict[str, Any]] = {}


def get_secret_json(secret_arn: str) -> dict[str, Any]:
    """Fetch a secret from AWS Secrets Manager and parse JSON."""
    if secret_arn in _SECRET_CACHE:
        return _SECRET_CACHE[secret_arn]

    client = get_secretsmanager_client()
    response = client.get_secret_value(SecretId=secret_arn)
    secret_str = response.get("SecretString")
    if not secret_str and response.get("SecretBinary"):
        secret_str = base64.b64decode(response["SecretBinary"]).decode("utf-8")
    if not secret_str:
        raise RuntimeError("Secret value is empty")

    secret_payload = json.loads(secret_str)
    _SECRET_CACHE[secret_arn] = secret_payload
    return secret_payload


def clear_secret_cache() -> None:
    """Clear cached secrets (useful in tests)."""
    _SECRET_CACHE.clear()
