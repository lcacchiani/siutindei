"""Tests for activity search cursor encoding."""

from __future__ import annotations

import base64
import json
import sys
from pathlib import Path
from uuid import UUID
from uuid import uuid4

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from app.api.activities_search import _decode_cursor  # noqa: E402
from app.api.activities_search import _encode_cursor  # noqa: E402
from app.api.activities_search import _parse_cursor  # noqa: E402


def test_encode_decode_cursor_roundtrip() -> None:
    """Ensure cursor roundtrips to the same schedule id."""

    schedule_id = uuid4()
    cursor = _encode_cursor(schedule_id)
    payload = _decode_cursor(cursor)
    assert payload["schedule_id"] == str(schedule_id)


def test_parse_cursor_returns_uuid() -> None:
    """Ensure the cursor parser returns a UUID."""

    schedule_id = uuid4()
    cursor = _encode_cursor(schedule_id)
    parsed = _parse_cursor(cursor)
    assert isinstance(parsed, UUID)
    assert parsed == schedule_id


def test_parse_cursor_rejects_invalid_value() -> None:
    """Ensure invalid cursors raise an error."""

    raw = json.dumps({"schedule_id": "not-a-uuid"}).encode("utf-8")
    cursor = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
    with pytest.raises(ValueError, match="Invalid cursor"):
        _parse_cursor(cursor)
