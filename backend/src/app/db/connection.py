"""Database connection helpers for Lambda runtime."""

from __future__ import annotations

import base64
import json
import os
from typing import Any
from urllib.parse import quote_plus

import boto3

_SECRET_CACHE: dict[str, dict[str, Any]] = {}


def get_database_url() -> str:
    """Resolve the database URL from env or Secrets Manager."""

    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    secret_arn = os.getenv("DATABASE_SECRET_ARN")
    if not secret_arn:
        raise RuntimeError("DATABASE_URL or DATABASE_SECRET_ARN is required")

    secret = _get_secret(secret_arn)
    username = secret.get("username") or secret.get("user")
    password = secret.get("password")
    host = secret.get("host")
    port = secret.get("port") or 5432
    database = (
        secret.get("dbname")
        or secret.get("database")
        or os.getenv("DATABASE_NAME")
        or "activities"
    )

    if not username or not password or not host:
        raise RuntimeError("Secret is missing database connection fields")

    return (
        "postgresql+psycopg://"
        f"{quote_plus(str(username))}:{quote_plus(str(password))}"
        f"@{host}:{port}/{database}"
    )


def _get_secret(secret_arn: str) -> dict[str, Any]:
    """Fetch a secret from AWS Secrets Manager."""

    if secret_arn in _SECRET_CACHE:
        return _SECRET_CACHE[secret_arn]

    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId=secret_arn)
    secret_str = response.get("SecretString")
    if not secret_str and response.get("SecretBinary"):
        secret_str = base64.b64decode(response["SecretBinary"]).decode("utf-8")

    if not secret_str:
        raise RuntimeError("Secret value is empty")

    secret_payload = json.loads(secret_str)
    _SECRET_CACHE[secret_arn] = secret_payload
    return secret_payload
