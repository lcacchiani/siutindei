"""Lambda handler for search.

This module provides the public search API endpoint,
using shared utilities and centralized database management.
"""

from __future__ import annotations

import base64
import json
from dataclasses import replace
from typing import Any
from typing import Mapping
from uuid import UUID

from sqlalchemy.orm import Session, selectinload

from app.api.schemas import ActivitySchema
from app.api.schemas import ActivitySearchResponseSchema
from app.api.schemas import ActivitySearchResultSchema
from app.api.schemas import LocationSchema
from app.api.schemas import OrganizationSchema
from app.api.schemas import PricingSchema
from app.api.schemas import ScheduleEntrySchema, ScheduleSchema
from app.db.engine import get_engine
from app.db.models import Activity
from app.db.models import ActivityPricing
from app.db.models import ActivitySchedule
from app.db.models import Location
from app.db.models import Organization
from app.db.models import PricingType
from app.db.models import ScheduleType
from app.db.queries import ActivitySearchCursor
from app.db.queries import ActivitySearchFilters
from app.db.queries import build_search_query
from app.exceptions import CursorError, ValidationError
from app.utils import json_response, parse_decimal, parse_enum, parse_int
from app.utils.logging import configure_logging, get_logger, set_request_context
from app.utils.parsers import collect_query_params, first_param, parse_languages
from app.utils.responses import get_cors_headers
from app.utils.translations import build_translation_map

# Configure logging on module load
configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle API Gateway request for search."""

    # Set request context for logging
    request_id = event.get("requestContext", {}).get("requestId", "")
    set_request_context(req_id=request_id)

    try:
        filters = parse_filters(event)
        logger.debug("Search filters parsed", extra={"filters": str(filters)})
        response = fetch_search_response(filters)
        logger.info(
            f"Search completed: {len(response.items)} results",
            extra={
                "count": len(response.items),
                "has_more": response.next_cursor is not None,
            },
        )
        return _create_response(200, response, event)
    except (ValidationError, CursorError) as exc:
        logger.warning(f"Validation error: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except ValueError as exc:
        logger.warning(f"Value error: {exc}")
        return json_response(400, {"error": str(exc)}, event=event)
    except Exception as exc:  # pragma: no cover - safety net
        logger.exception("Unexpected error in search")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


def parse_filters(event: Mapping[str, Any]) -> ActivitySearchFilters:
    """Parse query parameters into search filters."""

    params = collect_query_params(event)

    area_id_str = first_param(params, "area_id")
    area_id = UUID(area_id_str) if area_id_str else None

    return ActivitySearchFilters(
        age=parse_int(first_param(params, "age")),
        area_id=area_id,
        pricing_type=parse_enum(first_param(params, "pricing_type"), PricingType),
        price_min=parse_decimal(first_param(params, "price_min")),
        price_max=parse_decimal(first_param(params, "price_max")),
        schedule_type=parse_enum(
            first_param(params, "schedule_type"),
            ScheduleType,
        ),
        day_of_week_utc=parse_int(first_param(params, "day_of_week_utc")),
        start_minutes_utc=parse_int(first_param(params, "start_minutes_utc")),
        end_minutes_utc=parse_int(first_param(params, "end_minutes_utc")),
        languages=parse_languages(params.get("language", [])),
        cursor=_parse_cursor(first_param(params, "cursor")),
        limit=parse_int(first_param(params, "limit")) or 50,
    )


def fetch_search_response(
    filters: ActivitySearchFilters,
) -> ActivitySearchResponseSchema:
    """Fetch search response from the database."""

    engine = get_engine()
    requested_limit = filters.limit
    query_filters = replace(filters, limit=requested_limit + 1)
    query = build_search_query(query_filters).options(
        selectinload(ActivitySchedule.entries)
    )

    with Session(engine) as session:
        rows = session.execute(query).all()

    has_more = len(rows) > requested_limit
    trimmed_rows = rows[:requested_limit]
    items = [map_row_to_result(row) for row in trimmed_rows]
    next_cursor = None
    if has_more and trimmed_rows:
        last_row = trimmed_rows[-1]
        schedule = last_row._mapping[ActivitySchedule]
        order_day = last_row._mapping["order_day_of_week"]
        order_start = last_row._mapping["order_start_minutes"]
        next_cursor = _encode_cursor(order_day, order_start, schedule.id)
    return ActivitySearchResponseSchema(items=items, next_cursor=next_cursor)


def map_row_to_result(row: Any) -> ActivitySearchResultSchema:
    """Map a SQLAlchemy row to a search result schema."""

    mapping = row._mapping
    activity: Activity = mapping[Activity]
    organization: Organization = mapping[Organization]
    location: Location = mapping[Location]
    pricing: ActivityPricing = mapping[ActivityPricing]
    schedule: ActivitySchedule = mapping[ActivitySchedule]

    age_min, age_max = _extract_age_bounds(activity.age_range)

    return ActivitySearchResultSchema(
        activity=ActivitySchema(
            id=str(activity.id),
            name=activity.name,
            description=activity.description,
            name_translations=build_translation_map(
                activity.name, activity.name_translations
            ),
            description_translations=build_translation_map(
                activity.description, activity.description_translations
            ),
            age_min=age_min,
            age_max=age_max,
        ),
        organization=OrganizationSchema(
            id=str(organization.id),
            name=organization.name,
            description=organization.description,
            name_translations=build_translation_map(
                organization.name, organization.name_translations
            ),
            description_translations=build_translation_map(
                organization.description, organization.description_translations
            ),
            manager_id=organization.manager_id,
            media_urls=organization.media_urls or [],
            logo_media_url=organization.logo_media_url,
        ),
        location=LocationSchema(
            id=str(location.id),
            area_id=str(location.area_id),
            address=location.address,
            lat=location.lat,
            lng=location.lng,
        ),
        pricing=PricingSchema(
            pricing_type=pricing.pricing_type.value,
            amount=pricing.amount,
            currency=pricing.currency,
            sessions_count=pricing.sessions_count,
            free_trial_class_offered=pricing.free_trial_class_offered,
        ),
        schedule=ScheduleSchema(
            schedule_type=schedule.schedule_type.value,
            weekly_entries=_serialize_weekly_entries(schedule),
            languages=schedule.languages or [],
        ),
    )


def _serialize_weekly_entries(
    schedule: ActivitySchedule,
) -> list[ScheduleEntrySchema]:
    """Serialize schedule entries for search responses."""
    entries = sorted(
        schedule.entries or [],
        key=lambda entry: (
            entry.day_of_week_utc,
            entry.start_minutes_utc,
            entry.end_minutes_utc,
        ),
    )
    return [
        ScheduleEntrySchema(
            day_of_week_utc=entry.day_of_week_utc,
            start_minutes_utc=entry.start_minutes_utc,
            end_minutes_utc=entry.end_minutes_utc,
        )
        for entry in entries
    ]


def _extract_age_bounds(age_range: Any) -> tuple[int | None, int | None]:
    """Extract age range bounds from a database range value."""

    lower = getattr(age_range, "lower", None)
    upper = getattr(age_range, "upper", None)
    if lower is not None or upper is not None:
        return lower, upper

    if isinstance(age_range, str):
        cleaned = age_range.strip("[]()")
        parts = cleaned.split(",")
        if len(parts) == 2:
            try:
                return int(parts[0]), int(parts[1])
            except ValueError:
                return None, None
    return None, None


def _create_response(
    status_code: int,
    body: ActivitySearchResponseSchema,
    event: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a JSON API Gateway response for Pydantic models."""

    payload = body.model_dump() if hasattr(body, "model_dump") else body.dict()

    headers = {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
    }
    headers.update(get_cors_headers(event))

    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(payload, default=str),
    }


# --- Cursor encoding/decoding ---


def _parse_cursor(value: str | None) -> ActivitySearchCursor | None:
    """Parse a pagination cursor."""

    if value is None or value == "":
        return None
    try:
        payload = _decode_cursor(value)
        return ActivitySearchCursor(
            day_of_week_utc=payload["day_of_week_utc"],
            start_minutes_utc=payload["start_minutes_utc"],
            schedule_id=UUID(payload["schedule_id"]),
        )
    except (ValueError, KeyError, TypeError) as exc:
        raise CursorError("Malformed cursor payload") from exc


def _encode_cursor(
    day_of_week_utc: int,
    start_minutes_utc: int,
    schedule_id: UUID,
) -> str:
    """Encode a pagination cursor."""
    payload = json.dumps(
        {
            "schedule_id": str(schedule_id),
            "day_of_week_utc": day_of_week_utc,
            "start_minutes_utc": start_minutes_utc,
        }
    ).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("utf-8")
    return encoded.rstrip("=")


def _decode_cursor(cursor: str) -> dict[str, Any]:
    """Decode a pagination cursor."""

    padding = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(cursor + padding)
    return json.loads(raw)
