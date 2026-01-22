"""Tests for admin authorization logic."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from app.api.admin import _is_admin  # noqa: E402


def test_is_admin_true_with_group() -> None:
    """Ensure admin is detected when group is present."""

    event = {
        "requestContext": {
            "authorizer": {
                "claims": {"cognito:groups": "admin,staff"},
            }
        }
    }
    assert _is_admin(event)


def test_is_admin_false_without_group() -> None:
    """Ensure admin is false when group is missing."""

    event = {
        "requestContext": {
            "authorizer": {
                "claims": {"cognito:groups": "staff"},
            }
        }
    }
    assert not _is_admin(event)


def test_is_admin_false_without_claims() -> None:
    """Ensure admin is false when claims are missing."""

    event = {"requestContext": {}}
    assert not _is_admin(event)
