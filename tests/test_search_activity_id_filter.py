"""Tests for activity_id search filter."""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import UUID

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from app.api.search import parse_filters  # noqa: E402
from app.db.queries import ActivitySearchFilters, build_search_query  # noqa: E402


def test_parse_filters_reads_activity_id() -> None:
    activity_id = "dddddddd-dddd-dddd-dddd-dddddddddddd"
    event = {
        "queryStringParameters": {
            "activity_id": activity_id,
        },
    }

    filters = parse_filters(event)

    assert filters.activity_id == UUID(activity_id)


def test_build_search_query_applies_activity_id() -> None:
    """Activity id is constrained on activities.id in the WHERE clause."""

    activity_id = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    query = build_search_query(
        ActivitySearchFilters(activity_id=activity_id, limit=10),
    )
    where_clause = str(query.whereclause)
    assert "activities.id" in where_clause
