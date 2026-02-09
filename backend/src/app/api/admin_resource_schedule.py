"""Schedule resource handlers."""

from __future__ import annotations

from typing import Any

from app.api.admin_request import _parse_uuid
from app.api.admin_validators import _parse_languages
from app.db.models import ActivitySchedule, ScheduleType
from app.db.repositories import ActivityScheduleRepository
from app.exceptions import ValidationError
from app.utils import parse_datetime


def _create_schedule(
    repo: ActivityScheduleRepository, body: dict[str, Any]
) -> ActivitySchedule:
    """Create activity schedule."""
    del repo
    activity_id = body.get("activity_id")
    location_id = body.get("location_id")
    schedule_type = body.get("schedule_type")
    if not activity_id or not location_id or not schedule_type:
        raise ValidationError(
            "activity_id, location_id, and schedule_type are required"
        )

    schedule_enum = ScheduleType(schedule_type)
    schedule = ActivitySchedule(
        activity_id=_parse_uuid(activity_id),
        location_id=_parse_uuid(location_id),
        schedule_type=schedule_enum,
        languages=_parse_languages(body.get("languages")),
    )
    _apply_schedule_fields(schedule, body, update_only=False)
    _validate_schedule(schedule)
    return schedule


def _update_schedule(
    repo: ActivityScheduleRepository,
    entity: ActivitySchedule,
    body: dict[str, Any],
) -> ActivitySchedule:
    """Update activity schedule."""
    del repo
    if "schedule_type" in body:
        entity.schedule_type = ScheduleType(body["schedule_type"])
    if "languages" in body:
        entity.languages = _parse_languages(body["languages"])
    _apply_schedule_fields(entity, body, update_only=True)
    _validate_schedule(entity)
    return entity


def _apply_schedule_fields(
    entity: ActivitySchedule,
    body: dict[str, Any],
    update_only: bool,
) -> None:
    """Apply schedule-specific fields."""
    _set_if_present(entity, "day_of_week_utc", body, update_only)
    _set_if_present(entity, "day_of_month", body, update_only)
    _set_if_present(entity, "start_minutes_utc", body, update_only)
    _set_if_present(entity, "end_minutes_utc", body, update_only)

    if not update_only or "start_at_utc" in body:
        entity.start_at_utc = parse_datetime(body.get("start_at_utc"))
    if not update_only or "end_at_utc" in body:
        entity.end_at_utc = parse_datetime(body.get("end_at_utc"))


def _set_if_present(
    entity: ActivitySchedule,
    field_name: str,
    body: dict[str, Any],
    update_only: bool,
) -> None:
    """Set a field on the entity if present in body or create mode."""
    if not update_only or field_name in body:
        setattr(entity, field_name, body.get(field_name))


def _serialize_schedule(entity: ActivitySchedule) -> dict[str, Any]:
    """Serialize schedule."""
    return {
        "id": str(entity.id),
        "activity_id": str(entity.activity_id),
        "location_id": str(entity.location_id),
        "schedule_type": entity.schedule_type.value,
        "day_of_week_utc": entity.day_of_week_utc,
        "day_of_month": entity.day_of_month,
        "start_minutes_utc": entity.start_minutes_utc,
        "end_minutes_utc": entity.end_minutes_utc,
        "start_at_utc": entity.start_at_utc,
        "end_at_utc": entity.end_at_utc,
        "languages": entity.languages,
    }


def _validate_schedule(schedule: ActivitySchedule) -> None:
    """Validate schedule fields for the given schedule type."""
    if schedule.schedule_type == ScheduleType.WEEKLY:
        if schedule.day_of_week_utc is None:
            raise ValidationError("day_of_week_utc is required for weekly schedules")
        if schedule.start_minutes_utc is None or schedule.end_minutes_utc is None:
            raise ValidationError(
                "start_minutes_utc and end_minutes_utc are required for weekly"
            )
    elif schedule.schedule_type == ScheduleType.MONTHLY:
        if schedule.day_of_month is None:
            raise ValidationError("day_of_month is required for monthly schedules")
        if schedule.start_minutes_utc is None or schedule.end_minutes_utc is None:
            raise ValidationError(
                "start_minutes_utc and end_minutes_utc are required for monthly"
            )
    elif schedule.schedule_type == ScheduleType.DATE_SPECIFIC:
        if schedule.start_at_utc is None or schedule.end_at_utc is None:
            raise ValidationError(
                "start_at_utc and end_at_utc are required for date-specific"
            )

    # Validate day_of_week_utc range (0-6, Sunday to Saturday)
    if schedule.day_of_week_utc is not None:
        if not 0 <= schedule.day_of_week_utc <= 6:
            raise ValidationError(
                "day_of_week_utc must be between 0 and 6",
                field="day_of_week_utc",
            )

    # Validate day_of_month range (1-31)
    if schedule.day_of_month is not None:
        if not 1 <= schedule.day_of_month <= 31:
            raise ValidationError(
                "day_of_month must be between 1 and 31",
                field="day_of_month",
            )

    # Validate start_minutes_utc range (0-1439, minutes in a day)
    if schedule.start_minutes_utc is not None:
        if not 0 <= schedule.start_minutes_utc <= 1439:
            raise ValidationError(
                "start_minutes_utc must be between 0 and 1439",
                field="start_minutes_utc",
            )

    # Validate end_minutes_utc range (0-1439, minutes in a day)
    if schedule.end_minutes_utc is not None:
        if not 0 <= schedule.end_minutes_utc <= 1439:
            raise ValidationError(
                "end_minutes_utc must be between 0 and 1439",
                field="end_minutes_utc",
            )

    # Validate start_minutes_utc and end_minutes_utc are not equal
    if (
        schedule.start_minutes_utc is not None
        and schedule.end_minutes_utc is not None
        and schedule.start_minutes_utc == schedule.end_minutes_utc
    ):
        raise ValidationError(
            "start_minutes_utc must not equal end_minutes_utc",
            field="start_minutes_utc",
        )

    # Validate start_at_utc < end_at_utc
    if (
        schedule.start_at_utc is not None
        and schedule.end_at_utc is not None
        and schedule.start_at_utc >= schedule.end_at_utc
    ):
        raise ValidationError(
            "start_at_utc must be less than end_at_utc",
            field="start_at_utc",
        )
