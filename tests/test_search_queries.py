"""Tests for search query building."""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from app.db.queries import ActivitySearchCursor  # noqa: E402
from app.db.queries import ActivitySearchFilters  # noqa: E402
from app.db.queries import build_search_query  # noqa: E402
from app.db.queries import validate_filters  # noqa: E402


def test_validate_filters_rejects_invalid_minutes() -> None:
    """Ensure start_minutes_utc is less than end_minutes_utc."""

    filters = ActivitySearchFilters(start_minutes_utc=600, end_minutes_utc=540)
    with pytest.raises(ValueError, match="start_minutes_utc"):
        validate_filters(filters)


def test_build_search_query_includes_wrap_conditions() -> None:
    """Ensure wrapped schedules are considered for time filters."""

    filters = ActivitySearchFilters(start_minutes_utc=480, end_minutes_utc=600)
    query = build_search_query(filters)
    where_clause = str(query)
    wrap_fragment = (
        "activity_schedule_entries.start_minutes_utc > "
        "activity_schedule_entries.end_minutes_utc"
    )
    assert wrap_fragment in where_clause


def test_build_search_query_sets_limit() -> None:
    """Ensure the query sets a limit."""

    filters = ActivitySearchFilters(limit=25)
    query = build_search_query(filters)
    assert query._limit_clause is not None


def test_build_search_query_applies_cursor() -> None:
    """Ensure the cursor filter is applied."""

    cursor_id = uuid4()
    cursor = ActivitySearchCursor(
        day_of_week_utc=2,
        start_minutes_utc=480,
        schedule_id=cursor_id,
    )
    filters = ActivitySearchFilters(cursor=cursor)
    query = build_search_query(filters)
    where_clause = str(query.whereclause)
    assert "activity_schedule.id" in where_clause
