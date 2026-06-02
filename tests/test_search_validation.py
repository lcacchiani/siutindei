"""Tests for search query parameter validation."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.api.search_validation import validate_search_query_params
from app.exceptions import ValidationError


def test_validate_search_rejects_negative_age() -> None:
    with pytest.raises(ValidationError) as exc:
        validate_search_query_params(
            age=-1,
            day_of_week_utc=None,
            start_minutes_utc=None,
            end_minutes_utc=None,
            price_min=None,
            price_max=None,
            languages=[],
            limit=50,
        )
    assert exc.value.field == "age"


def test_validate_search_rejects_invalid_day_of_week() -> None:
    with pytest.raises(ValidationError) as exc:
        validate_search_query_params(
            age=None,
            day_of_week_utc=7,
            start_minutes_utc=None,
            end_minutes_utc=None,
            price_min=None,
            price_max=None,
            languages=[],
            limit=50,
        )
    assert exc.value.field == "day_of_week_utc"


def test_validate_search_rejects_price_min_above_max() -> None:
    with pytest.raises(ValidationError) as exc:
        validate_search_query_params(
            age=None,
            day_of_week_utc=None,
            start_minutes_utc=None,
            end_minutes_utc=None,
            price_min=Decimal("100"),
            price_max=Decimal("10"),
            languages=[],
            limit=50,
        )
    assert exc.value.field == "price_min"


def test_validate_search_rejects_invalid_language_code() -> None:
    with pytest.raises(ValidationError):
        validate_search_query_params(
            age=None,
            day_of_week_utc=None,
            start_minutes_utc=None,
            end_minutes_utc=None,
            price_min=None,
            price_max=None,
            languages=["not-a-language"],
            limit=50,
        )


def test_validate_search_rejects_limit_out_of_range() -> None:
    with pytest.raises(ValidationError) as exc:
        validate_search_query_params(
            age=None,
            day_of_week_utc=None,
            start_minutes_utc=None,
            end_minutes_utc=None,
            price_min=None,
            price_max=None,
            languages=[],
            limit=0,
        )
    assert exc.value.field == "limit"
