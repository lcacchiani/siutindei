"""Shared boto3 client factory with caching."""

from __future__ import annotations

from typing import Any

import boto3

_CLIENT_CACHE: dict[tuple[str, str | None], Any] = {}


def get_client(service: str, region_name: str | None = None) -> Any:
    """Return a cached boto3 client for the given service."""
    cache_key = (service, region_name)
    if cache_key in _CLIENT_CACHE:
        return _CLIENT_CACHE[cache_key]
    client = boto3.client(  # type: ignore[call-overload]
        service,
        region_name=region_name,
    )
    _CLIENT_CACHE[cache_key] = client
    return client


def clear_client_cache() -> None:
    """Clear cached boto3 clients (useful in tests)."""
    _CLIENT_CACHE.clear()


def get_ses_client(region_name: str | None = None) -> Any:
    return get_client("ses", region_name=region_name)


def get_sns_client(region_name: str | None = None) -> Any:
    return get_client("sns", region_name=region_name)


def get_s3_client(region_name: str | None = None) -> Any:
    return get_client("s3", region_name=region_name)


def get_secretsmanager_client(region_name: str | None = None) -> Any:
    return get_client("secretsmanager", region_name=region_name)


def get_cognito_idp_client(region_name: str | None = None) -> Any:
    return get_client("cognito-idp", region_name=region_name)


def get_rds_client(region_name: str | None = None) -> Any:
    return get_client("rds", region_name=region_name)
