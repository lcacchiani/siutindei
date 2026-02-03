"""Tests for activity schedule validation logic."""

from __future__ import annotations

import sys
from datetime import datetime
from datetime import timezone
from pathlib import Path
from uuid import uuid4

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from app.api.admin import _validate_schedule  # noqa: E402
from app.db.models import ActivitySchedule, ScheduleType  # noqa: E402
from app.exceptions import ValidationError  # noqa: E402


def make_weekly_schedule(
    day_of_week_utc: int = 1,
    start_minutes_utc: int = 600,
    end_minutes_utc: int = 660,
) -> ActivitySchedule:
    """Create a weekly schedule for testing."""
    return ActivitySchedule(
        activity_id=uuid4(),
        location_id=uuid4(),
        schedule_type=ScheduleType.WEEKLY,
        day_of_week_utc=day_of_week_utc,
        start_minutes_utc=start_minutes_utc,
        end_minutes_utc=end_minutes_utc,
        languages=["en"],
    )


def make_monthly_schedule(
    day_of_month: int = 15,
    start_minutes_utc: int = 600,
    end_minutes_utc: int = 660,
) -> ActivitySchedule:
    """Create a monthly schedule for testing."""
    return ActivitySchedule(
        activity_id=uuid4(),
        location_id=uuid4(),
        schedule_type=ScheduleType.MONTHLY,
        day_of_month=day_of_month,
        start_minutes_utc=start_minutes_utc,
        end_minutes_utc=end_minutes_utc,
        languages=["en"],
    )


def make_date_specific_schedule(
    start_at_utc: datetime | None = None,
    end_at_utc: datetime | None = None,
) -> ActivitySchedule:
    """Create a date-specific schedule for testing."""
    if start_at_utc is None:
        start_at_utc = datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc)
    if end_at_utc is None:
        end_at_utc = datetime(2026, 3, 1, 11, 0, tzinfo=timezone.utc)
    return ActivitySchedule(
        activity_id=uuid4(),
        location_id=uuid4(),
        schedule_type=ScheduleType.DATE_SPECIFIC,
        start_at_utc=start_at_utc,
        end_at_utc=end_at_utc,
        languages=["en"],
    )


class TestValidateScheduleWeekly:
    """Tests for weekly schedule validation."""

    def test_valid_weekly_schedule(self) -> None:
        """Valid weekly schedule should pass validation."""
        schedule = make_weekly_schedule(
            day_of_week_utc=0,  # Sunday
            start_minutes_utc=0,
            end_minutes_utc=1439,
        )
        _validate_schedule(schedule)  # Should not raise

    def test_day_of_week_utc_below_range(self) -> None:
        """day_of_week_utc below 0 should raise ValidationError."""
        schedule = make_weekly_schedule(day_of_week_utc=-1)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "day_of_week_utc must be between 0 and 6" in str(exc_info.value)
        assert exc_info.value.field == "day_of_week_utc"

    def test_day_of_week_utc_above_range(self) -> None:
        """day_of_week_utc above 6 should raise ValidationError."""
        schedule = make_weekly_schedule(day_of_week_utc=7)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "day_of_week_utc must be between 0 and 6" in str(exc_info.value)
        assert exc_info.value.field == "day_of_week_utc"

    def test_start_minutes_utc_below_range(self) -> None:
        """start_minutes_utc below 0 should raise ValidationError."""
        schedule = make_weekly_schedule(start_minutes_utc=-1)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "start_minutes_utc must be between 0 and 1439" in str(exc_info.value)
        assert exc_info.value.field == "start_minutes_utc"

    def test_start_minutes_utc_above_range(self) -> None:
        """start_minutes_utc above 1439 should raise ValidationError."""
        schedule = make_weekly_schedule(start_minutes_utc=1440)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "start_minutes_utc must be between 0 and 1439" in str(exc_info.value)
        assert exc_info.value.field == "start_minutes_utc"

    def test_end_minutes_utc_below_range(self) -> None:
        """end_minutes_utc below 0 should raise ValidationError."""
        schedule = make_weekly_schedule(end_minutes_utc=-1)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "end_minutes_utc must be between 0 and 1439" in str(exc_info.value)
        assert exc_info.value.field == "end_minutes_utc"

    def test_end_minutes_utc_above_range(self) -> None:
        """end_minutes_utc above 1439 should raise ValidationError."""
        schedule = make_weekly_schedule(end_minutes_utc=2000)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "end_minutes_utc must be between 0 and 1439" in str(exc_info.value)
        assert exc_info.value.field == "end_minutes_utc"

    def test_start_minutes_utc_equals_end_minutes_utc(self) -> None:
        """start_minutes_utc equal to end_minutes_utc should raise ValidationError."""
        schedule = make_weekly_schedule(start_minutes_utc=600, end_minutes_utc=600)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "start_minutes_utc must be less than end_minutes_utc" in str(
            exc_info.value
        )
        assert exc_info.value.field == "start_minutes_utc"

    def test_start_minutes_utc_greater_than_end_minutes_utc(self) -> None:
        """start_minutes_utc greater than end_minutes_utc should raise ValidationError."""
        schedule = make_weekly_schedule(start_minutes_utc=700, end_minutes_utc=600)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "start_minutes_utc must be less than end_minutes_utc" in str(
            exc_info.value
        )
        assert exc_info.value.field == "start_minutes_utc"


class TestValidateScheduleMonthly:
    """Tests for monthly schedule validation."""

    def test_valid_monthly_schedule(self) -> None:
        """Valid monthly schedule should pass validation."""
        schedule = make_monthly_schedule(
            day_of_month=1,
            start_minutes_utc=0,
            end_minutes_utc=1439,
        )
        _validate_schedule(schedule)  # Should not raise

    def test_day_of_month_below_range(self) -> None:
        """day_of_month below 1 should raise ValidationError."""
        schedule = make_monthly_schedule(day_of_month=0)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "day_of_month must be between 1 and 31" in str(exc_info.value)
        assert exc_info.value.field == "day_of_month"

    def test_day_of_month_above_range(self) -> None:
        """day_of_month above 31 should raise ValidationError."""
        schedule = make_monthly_schedule(day_of_month=32)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "day_of_month must be between 1 and 31" in str(exc_info.value)
        assert exc_info.value.field == "day_of_month"

    def test_monthly_schedule_minutes_validation(self) -> None:
        """Monthly schedule should also validate minutes range."""
        schedule = make_monthly_schedule(end_minutes_utc=2000)
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "end_minutes_utc must be between 0 and 1439" in str(exc_info.value)


class TestValidateScheduleDateSpecific:
    """Tests for date-specific schedule validation."""

    def test_valid_date_specific_schedule(self) -> None:
        """Valid date-specific schedule should pass validation."""
        schedule = make_date_specific_schedule()
        _validate_schedule(schedule)  # Should not raise

    def test_start_at_utc_equals_end_at_utc(self) -> None:
        """start_at_utc equal to end_at_utc should raise ValidationError."""
        same_time = datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc)
        schedule = make_date_specific_schedule(
            start_at_utc=same_time, end_at_utc=same_time
        )
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "start_at_utc must be less than end_at_utc" in str(exc_info.value)
        assert exc_info.value.field == "start_at_utc"

    def test_start_at_utc_after_end_at_utc(self) -> None:
        """start_at_utc after end_at_utc should raise ValidationError."""
        schedule = make_date_specific_schedule(
            start_at_utc=datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc),
            end_at_utc=datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc),
        )
        with pytest.raises(ValidationError) as exc_info:
            _validate_schedule(schedule)
        assert "start_at_utc must be less than end_at_utc" in str(exc_info.value)
        assert exc_info.value.field == "start_at_utc"


class TestValidateScheduleBoundaryValues:
    """Tests for boundary values."""

    @pytest.mark.parametrize("day_of_week", [0, 1, 2, 3, 4, 5, 6])
    def test_all_valid_days_of_week(self, day_of_week: int) -> None:
        """All days 0-6 should be valid."""
        schedule = make_weekly_schedule(day_of_week_utc=day_of_week)
        _validate_schedule(schedule)  # Should not raise

    @pytest.mark.parametrize("day_of_month", [1, 15, 28, 29, 30, 31])
    def test_all_valid_days_of_month(self, day_of_month: int) -> None:
        """All days 1-31 should be valid."""
        schedule = make_monthly_schedule(day_of_month=day_of_month)
        _validate_schedule(schedule)  # Should not raise

    def test_minimum_minutes_values(self) -> None:
        """Minimum minute values (0, 1) should be valid."""
        schedule = make_weekly_schedule(start_minutes_utc=0, end_minutes_utc=1)
        _validate_schedule(schedule)  # Should not raise

    def test_maximum_minutes_values(self) -> None:
        """Maximum minute values (1438, 1439) should be valid."""
        schedule = make_weekly_schedule(start_minutes_utc=1438, end_minutes_utc=1439)
        _validate_schedule(schedule)  # Should not raise
