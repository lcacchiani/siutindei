"""Tests for activity_id search filter."""

from uuid import UUID

from app.api.search import parse_filters
from app.db.queries import ActivitySearchFilters, build_search_query


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
    activity_id = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    query = build_search_query(
        ActivitySearchFilters(activity_id=activity_id, limit=10),
    )
    compiled = str(query.compile(compile_kwargs={"literal_binds": True}))
    assert str(activity_id) in compiled
