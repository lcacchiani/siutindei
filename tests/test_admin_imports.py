"""Tests for admin import helpers."""

from __future__ import annotations

import pytest

from app.api.admin_imports_utils import from_utc_weekly
from app.api.admin_imports_utils import parse_time_minutes
from app.api.admin_imports_utils import parse_timezone
from app.api.admin_imports_utils import to_utc_weekly
from app.exceptions import ValidationError


def test_parse_time_minutes_accepts_hhmm() -> None:
    assert parse_time_minutes("09:30", "start_time") == 9 * 60 + 30


def test_parse_time_minutes_rejects_invalid() -> None:
    with pytest.raises(ValidationError):
        parse_time_minutes("25:00", "start_time")


def test_timezone_validation_requires_iana() -> None:
    with pytest.raises(ValidationError):
        parse_timezone("Not/A_Timezone", "timezone")


def test_utc_round_trip_preserves_weekly_entry() -> None:
    tz = parse_timezone("UTC", "timezone")
    day_utc, start_utc, end_utc = to_utc_weekly(1, 9 * 60, 10 * 60, tz)
    local_day, local_start, local_end = from_utc_weekly(
        day_utc,
        start_utc,
        end_utc,
        tz,
    )
    assert local_day == 1
    assert local_start == 9 * 60
    assert local_end == 10 * 60
