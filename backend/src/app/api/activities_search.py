"""Lambda handler for activity search."""

from __future__ import annotations

import base64
import json
import os
from dataclasses import asdict
from dataclasses import replace
from datetime import datetime
from decimal import Decimal
from typing import Any
from typing import Mapping
from typing import Sequence

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool
from uuid import UUID

from app.api.schemas import ActivitySchema
from app.api.schemas import ActivitySearchResponseSchema
from app.api.schemas import ActivitySearchResultSchema
from app.api.schemas import LocationSchema
from app.api.schemas import OrganizationSchema
from app.api.schemas import PricingSchema
from app.api.schemas import ScheduleSchema
from app.db.models import Activity
from app.db.models import ActivityPricing
from app.db.models import ActivitySchedule
from app.db.models import Location
from app.db.models import Organization
from app.db.models import PricingType
from app.db.models import ScheduleType
from app.db.connection import get_database_url
from app.db.queries import ActivitySearchFilters
from app.db.queries import build_activity_search_query

_ENGINE = None


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle API Gateway request for activity search."""

    try:
        filters = parse_filters(event)
        response = fetch_activity_search_response(filters)
        return _json_response(200, response)
    except ValueError as exc:
        return _json_response(400, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover - safety net
        return _json_response(500, {"error": "Internal server error", "detail": str(exc)})


def parse_filters(event: Mapping[str, Any]) -> ActivitySearchFilters:
    """Parse query parameters into activity search filters."""

    params = _collect_query_params(event)

    return ActivitySearchFilters(
        age=_parse_int(_first(params, "age")),
        district=_first(params, "district"),
        pricing_type=_parse_enum(_first(params, "pricing_type"), PricingType),
        price_min=_parse_decimal(_first(params, "price_min")),
        price_max=_parse_decimal(_first(params, "price_max")),
        schedule_type=_parse_enum(_first(params, "schedule_type"), ScheduleType),
        day_of_week_utc=_parse_int(_first(params, "day_of_week_utc")),
        day_of_month=_parse_int(_first(params, "day_of_month")),
        start_minutes_utc=_parse_int(_first(params, "start_minutes_utc")),
        end_minutes_utc=_parse_int(_first(params, "end_minutes_utc")),
        start_at_utc=_parse_datetime(_first(params, "start_at_utc")),
        end_at_utc=_parse_datetime(_first(params, "end_at_utc")),
        languages=_parse_languages(params),
        cursor_schedule_id=_parse_cursor(_first(params, "cursor")),
        limit=_parse_int(_first(params, "limit")) or 50,
    )


def fetch_activity_search_response(filters: ActivitySearchFilters) -> ActivitySearchResponseSchema:
    """Fetch activity search response from the database."""

    engine = _get_engine()
    requested_limit = filters.limit
    query_filters = replace(filters, limit=requested_limit + 1)
    query = build_activity_search_query(query_filters)

    with Session(engine) as session:
        rows = session.execute(query).all()

    has_more = len(rows) > requested_limit
    trimmed_rows = rows[:requested_limit]
    items = [map_row_to_result(row) for row in trimmed_rows]
    next_cursor = None
    if has_more and trimmed_rows:
        schedule = trimmed_rows[-1]._mapping[ActivitySchedule]
        next_cursor = _encode_cursor(schedule.id)
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
            age_min=age_min,
            age_max=age_max,
        ),
        organization=OrganizationSchema(
            id=str(organization.id),
            name=organization.name,
            description=organization.description,
        ),
        location=LocationSchema(
            id=str(location.id),
            district=location.district,
            address=location.address,
            lat=location.lat,
            lng=location.lng,
        ),
        pricing=PricingSchema(
            pricing_type=pricing.pricing_type.value,
            amount=pricing.amount,
            currency=pricing.currency,
            sessions_count=pricing.sessions_count,
        ),
        schedule=ScheduleSchema(
            schedule_type=schedule.schedule_type.value,
            day_of_week_utc=schedule.day_of_week_utc,
            day_of_month=schedule.day_of_month,
            start_minutes_utc=schedule.start_minutes_utc,
            end_minutes_utc=schedule.end_minutes_utc,
            start_at_utc=schedule.start_at_utc,
            end_at_utc=schedule.end_at_utc,
            languages=schedule.languages or [],
        ),
    )


def _collect_query_params(event: Mapping[str, Any]) -> dict[str, list[str]]:
    """Collect query parameters from API Gateway events."""

    params: dict[str, list[str]] = {}
    single = event.get("queryStringParameters") or {}
    multi = event.get("multiValueQueryStringParameters") or {}

    for key, value in single.items():
        if value is None:
            continue
        params.setdefault(key, []).append(value)

    for key, values in multi.items():
        if not values:
            continue
        for value in values:
            if value is None:
                continue
            params.setdefault(key, []).append(value)

    return params


def _first(params: Mapping[str, Sequence[str]], key: str) -> str | None:
    """Return the first query parameter value for a key."""

    values = params.get(key, [])
    return values[0] if values else None


def _parse_languages(params: Mapping[str, Sequence[str]]) -> list[str]:
    """Parse language filters from query parameters."""

    values = params.get("language", [])
    languages: list[str] = []
    for value in values:
        for item in value.split(","):
            item = item.strip()
            if item:
                languages.append(item)
    return languages


def _parse_int(value: str | None) -> int | None:
    """Parse an integer from a string."""

    if value is None or value == "":
        return None
    return int(value)


def _parse_decimal(value: str | None) -> Decimal | None:
    """Parse a decimal from a string."""

    if value is None or value == "":
        return None
    return Decimal(value)


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse an ISO-8601 datetime string."""

    if value is None or value == "":
        return None
    cleaned = value.replace("Z", "+00:00") if value.endswith("Z") else value
    return datetime.fromisoformat(cleaned)


def _parse_enum(value: str | None, enum_type: Any) -> Any | None:
    """Parse an enum value from a string."""

    if value is None or value == "":
        return None
    return enum_type(value)


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


def _get_engine():
    """Return a cached SQLAlchemy engine."""

    global _ENGINE
    use_iam_auth = str(os.getenv("DATABASE_IAM_AUTH", "")).lower() in {"1", "true", "yes"}
    pool_settings = _pool_settings(use_iam_auth)
    if _ENGINE is None or use_iam_auth:
        database_url = get_database_url()
        engine = create_engine(
            database_url,
            pool_pre_ping=True,
            connect_args=_ssl_connect_args(),
            **pool_settings,
        )
        if not use_iam_auth:
            _ENGINE = engine
        return engine
    return _ENGINE




def _json_response(status_code: int, body: Any) -> dict[str, Any]:
    """Create a JSON API Gateway response."""

    payload = body
    if isinstance(body, ActivitySearchResponseSchema):
        payload = _dump_pydantic(body)
    elif isinstance(body, dict):
        payload = body
    else:
        payload = asdict(body) if hasattr(body, "__dataclass_fields__") else body

    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, default=str),
    }


def _dump_pydantic(model: ActivitySearchResponseSchema) -> dict[str, Any]:
    """Dump a Pydantic model into a JSON-serializable dict."""

    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _ssl_connect_args() -> dict[str, str]:
    """Return SSL settings for database connections."""

    sslmode = os.getenv("DATABASE_SSLMODE", "require")
    return {"sslmode": sslmode}


def _pool_settings(use_iam_auth: bool) -> dict[str, Any]:
    """Return connection pool settings tuned for Lambda."""

    if use_iam_auth:
        return {"poolclass": NullPool}

    pool_size = int(os.getenv("DB_POOL_SIZE", "1"))
    max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "0"))
    pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "300"))
    pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))

    return {
        "pool_size": pool_size,
        "max_overflow": max_overflow,
        "pool_recycle": pool_recycle,
        "pool_timeout": pool_timeout,
    }


def _parse_cursor(value: str | None) -> UUID | None:
    """Parse a pagination cursor."""

    if value is None or value == "":
        return None
    try:
        payload = _decode_cursor(value)
        return UUID(payload["schedule_id"])
    except (ValueError, KeyError, TypeError) as exc:
        raise ValueError("Invalid cursor") from exc


def _encode_cursor(schedule_id: Any) -> str:
    """Encode a pagination cursor."""

    payload = json.dumps({"schedule_id": str(schedule_id)}).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("utf-8")
    return encoded.rstrip("=")


def _decode_cursor(cursor: str) -> dict[str, Any]:
    """Decode a pagination cursor."""

    padding = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(cursor + padding)
    return json.loads(raw)
