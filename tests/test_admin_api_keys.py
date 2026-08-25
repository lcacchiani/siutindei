"""Tests for the admin API key management handlers."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from app.api.admin_api_keys import (  # noqa: E402
    _handle_admin_api_keys,
    _key_status,
    _parse_optional_expiry,
    _serialize_api_key,
)
from app.db.models import ApiKey  # noqa: E402
from app.exceptions import ValidationError  # noqa: E402


def _post_event(body: dict) -> dict:
    return {
        "httpMethod": "POST",
        "path": "/v1/admin/api-keys",
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
        "requestContext": {"requestId": "req-1", "authorizer": {}},
    }


def _make_key(**overrides) -> ApiKey:
    values = {
        "id": uuid4(),
        "name": "Test key",
        "key_prefix": "stk_test_pre",
        "key_hash": "a" * 64,
        "scope": "read",
        "org_id": None,
        "created_by": None,
        "created_at": datetime.now(timezone.utc),
        "expires_at": None,
        "revoked_at": None,
        "last_used_at": None,
    }
    values.update(overrides)
    return ApiKey(**values)


def test_create_rejects_missing_name() -> None:
    """Creating a key without a name fails validation."""
    with pytest.raises(ValidationError, match="name"):
        _handle_admin_api_keys(_post_event({"scope": "read"}), "POST", None)


def test_create_rejects_invalid_scope() -> None:
    """Creating a key with an unknown scope fails validation."""
    with pytest.raises(ValidationError, match="scope"):
        _handle_admin_api_keys(
            _post_event({"name": "Partner", "scope": "admin"}),
            "POST",
            None,
        )


def test_create_rejects_invalid_org_id() -> None:
    """A malformed org_id fails validation before any database access."""
    with pytest.raises(ValidationError, match="UUID"):
        _handle_admin_api_keys(
            _post_event(
                {"name": "Partner", "scope": "read", "org_id": "not-a-uuid"}
            ),
            "POST",
            None,
        )


def test_create_rejects_past_expiry() -> None:
    """expires_at must be in the future."""
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    with pytest.raises(ValidationError, match="future"):
        _handle_admin_api_keys(
            _post_event({"name": "Partner", "scope": "read", "expires_at": past}),
            "POST",
            None,
        )


def test_create_rejects_malformed_expiry() -> None:
    """Garbage expires_at values are rejected."""
    with pytest.raises(ValidationError, match="expires_at"):
        _parse_optional_expiry("not-a-date")


def test_parse_optional_expiry_accepts_future_iso() -> None:
    """A future ISO timestamp is parsed to an aware datetime."""
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    parsed = _parse_optional_expiry(future)
    assert parsed is not None
    assert parsed.tzinfo is not None


def test_parse_optional_expiry_allows_empty() -> None:
    """Empty expiry means the key never expires."""
    assert _parse_optional_expiry(None) is None
    assert _parse_optional_expiry("") is None


def test_unsupported_method_returns_405() -> None:
    """PUT is not supported for API keys."""
    event = _post_event({})
    response = _handle_admin_api_keys(event, "PUT", str(uuid4()))
    assert response["statusCode"] == 405


def test_serialize_api_key_excludes_hash() -> None:
    """Serialized keys never expose the stored hash."""
    payload = _serialize_api_key(_make_key())
    assert "key_hash" not in payload
    assert payload["key_prefix"] == "stk_test_pre"
    assert payload["status"] == "active"


def test_key_status_revoked() -> None:
    """Revoked keys report the revoked status."""
    key = _make_key(revoked_at=datetime.now(timezone.utc))
    assert _key_status(key) == "revoked"


def test_key_status_expired() -> None:
    """Past expiry reports the expired status."""
    key = _make_key(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    assert _key_status(key) == "expired"


def test_key_status_active_with_future_expiry() -> None:
    """A future expiry keeps the key active."""
    key = _make_key(expires_at=datetime.now(timezone.utc) + timedelta(days=1))
    assert _key_status(key) == "active"
