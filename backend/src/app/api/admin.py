"""Admin CRUD API handlers."""

from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any
from typing import Callable
from typing import Mapping
from typing import Optional
from typing import Sequence
from typing import Tuple
from uuid import UUID

from psycopg.types.range import Range
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.connection import get_database_url
from app.db.models import Activity
from app.db.models import ActivityPricing
from app.db.models import ActivitySchedule
from app.db.models import Location
from app.db.models import Organization
from app.db.models import PricingType
from app.db.models import ScheduleType


@dataclass(frozen=True)
class ResourceConfig:
    """Configuration for admin resources."""

    name: str
    model: type
    serializer: Callable[[Any], dict[str, Any]]
    create_handler: Callable[[Session, dict[str, Any]], Any]
    update_handler: Callable[[Session, Any, dict[str, Any]], Any]


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle admin CRUD requests."""

    if not _is_admin(event):
        return _json_response(403, {"error": "Forbidden"})

    method = event.get("httpMethod", "")
    path = event.get("path", "")
    resource, resource_id = _parse_path(path)
    config = _RESOURCE_CONFIG.get(resource)
    if not config:
        return _json_response(404, {"error": "Not found"})

    try:
        if method == "GET":
            return _handle_get(event, config, resource_id)
        if method == "POST":
            return _handle_post(event, config)
        if method == "PUT":
            return _handle_put(event, config, resource_id)
        if method == "DELETE":
            return _handle_delete(event, config, resource_id)
        return _json_response(405, {"error": "Method not allowed"})
    except ValueError as exc:
        return _json_response(400, {"error": str(exc)})
    except Exception as exc:  # pragma: no cover
        return _json_response(500, {"error": "Internal server error", "detail": str(exc)})


def _handle_get(
    event: Mapping[str, Any],
    config: ResourceConfig,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle GET requests for admin resources."""

    limit = _parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 200:
        raise ValueError("limit must be between 1 and 200")

    with Session(_get_engine()) as session:
        if resource_id:
            entity = session.get(config.model, _parse_uuid(resource_id))
            if entity is None:
                return _json_response(404, {"error": "Not found"})
            return _json_response(200, config.serializer(entity))

        query = select(config.model).limit(limit)
        rows = session.execute(query).scalars().all()
        return _json_response(200, {"items": [config.serializer(row) for row in rows]})


def _handle_post(event: Mapping[str, Any], config: ResourceConfig) -> dict[str, Any]:
    """Handle POST requests for admin resources."""

    body = _parse_body(event)
    with Session(_get_engine()) as session:
        entity = config.create_handler(session, body)
        session.add(entity)
        session.commit()
        session.refresh(entity)
        return _json_response(201, config.serializer(entity))


def _handle_put(
    event: Mapping[str, Any],
    config: ResourceConfig,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle PUT requests for admin resources."""

    if not resource_id:
        raise ValueError("Resource id is required")

    body = _parse_body(event)
    with Session(_get_engine()) as session:
        entity = session.get(config.model, _parse_uuid(resource_id))
        if entity is None:
            return _json_response(404, {"error": "Not found"})
        updated = config.update_handler(session, entity, body)
        session.add(updated)
        session.commit()
        session.refresh(updated)
        return _json_response(200, config.serializer(updated))


def _handle_delete(
    event: Mapping[str, Any],
    config: ResourceConfig,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle DELETE requests for admin resources."""

    if not resource_id:
        raise ValueError("Resource id is required")

    with Session(_get_engine()) as session:
        entity = session.get(config.model, _parse_uuid(resource_id))
        if entity is None:
            return _json_response(404, {"error": "Not found"})
        session.delete(entity)
        session.commit()
        return _json_response(204, {})


def _parse_body(event: Mapping[str, Any]) -> dict[str, Any]:
    """Parse JSON request body."""

    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    if not raw:
        raise ValueError("Request body is required")
    return json.loads(raw)


def _parse_path(path: str) -> Tuple[str, Optional[str]]:
    """Parse resource name and id from the request path."""

    parts = [segment for segment in path.split("/") if segment]
    if len(parts) < 2 or parts[0] != "admin":
        return "", None
    resource = parts[1]
    resource_id = parts[2] if len(parts) > 2 else None
    return resource, resource_id


def _query_param(event: Mapping[str, Any], name: str) -> Optional[str]:
    """Return a query parameter value."""

    params = event.get("queryStringParameters") or {}
    return params.get(name)


def _parse_uuid(value: str) -> UUID:
    """Parse a UUID string."""

    return UUID(value)


def _parse_int(value: Optional[str]) -> Optional[int]:
    """Parse an integer."""

    if value is None or value == "":
        return None
    return int(value)


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO-8601 datetime string."""

    if value is None or value == "":
        return None
    cleaned = value.replace("Z", "+00:00") if value.endswith("Z") else value
    return datetime.fromisoformat(cleaned)


def _json_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    """Create JSON response."""

    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def _is_admin(event: Mapping[str, Any]) -> bool:
    """Return True when request belongs to an admin user."""

    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )
    groups = claims.get("cognito:groups", "")
    admin_group = os.getenv("ADMIN_GROUP", "admin")
    return admin_group in groups.split(",") if groups else False


def _get_engine():
    """Return a SQLAlchemy engine."""

    from sqlalchemy import create_engine
    from sqlalchemy.pool import NullPool

    database_url = get_database_url()
    return create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args={"sslmode": "require"},
        poolclass=NullPool,
    )


def _create_organization(session: Session, body: dict[str, Any]) -> Organization:
    """Create an organization."""

    name = body.get("name")
    if not name:
        raise ValueError("name is required")
    return Organization(name=name, description=body.get("description"))


def _update_organization(
    session: Session,
    entity: Organization,
    body: dict[str, Any],
) -> Organization:
    """Update an organization."""

    if "name" in body:
        entity.name = body["name"]
    if "description" in body:
        entity.description = body["description"]
    return entity


def _serialize_organization(entity: Organization) -> dict[str, Any]:
    """Serialize an organization."""

    return {
        "id": str(entity.id),
        "name": entity.name,
        "description": entity.description,
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }


def _create_location(session: Session, body: dict[str, Any]) -> Location:
    """Create a location."""

    org_id = body.get("org_id")
    district = body.get("district")
    if not org_id or not district:
        raise ValueError("org_id and district are required")
    return Location(
        org_id=_parse_uuid(org_id),
        district=district,
        address=body.get("address"),
        lat=body.get("lat"),
        lng=body.get("lng"),
    )


def _update_location(session: Session, entity: Location, body: dict[str, Any]) -> Location:
    """Update a location."""

    if "district" in body:
        entity.district = body["district"]
    if "address" in body:
        entity.address = body["address"]
    if "lat" in body:
        entity.lat = body["lat"]
    if "lng" in body:
        entity.lng = body["lng"]
    return entity


def _serialize_location(entity: Location) -> dict[str, Any]:
    """Serialize a location."""

    return {
        "id": str(entity.id),
        "org_id": str(entity.org_id),
        "district": entity.district,
        "address": entity.address,
        "lat": entity.lat,
        "lng": entity.lng,
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }


def _create_activity(session: Session, body: dict[str, Any]) -> Activity:
    """Create an activity."""

    org_id = body.get("org_id")
    name = body.get("name")
    age_min = body.get("age_min")
    age_max = body.get("age_max")
    if not org_id or not name or age_min is None or age_max is None:
        raise ValueError("org_id, name, age_min, and age_max are required")
    age_range = Range(int(age_min), int(age_max), bounds="[]")
    return Activity(
        org_id=_parse_uuid(org_id),
        name=name,
        description=body.get("description"),
        age_range=age_range,
    )


def _update_activity(session: Session, entity: Activity, body: dict[str, Any]) -> Activity:
    """Update an activity."""

    if "name" in body:
        entity.name = body["name"]
    if "description" in body:
        entity.description = body["description"]
    if "age_min" in body or "age_max" in body:
        age_min = body.get("age_min")
        age_max = body.get("age_max")
        if age_min is None or age_max is None:
            raise ValueError("age_min and age_max are required together")
        entity.age_range = Range(int(age_min), int(age_max), bounds="[]")
    return entity


def _serialize_activity(entity: Activity) -> dict[str, Any]:
    """Serialize an activity."""

    age_range = entity.age_range
    age_min = getattr(age_range, "lower", None)
    age_max = getattr(age_range, "upper", None)
    return {
        "id": str(entity.id),
        "org_id": str(entity.org_id),
        "name": entity.name,
        "description": entity.description,
        "age_min": age_min,
        "age_max": age_max,
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }


def _create_pricing(session: Session, body: dict[str, Any]) -> ActivityPricing:
    """Create activity pricing."""

    activity_id = body.get("activity_id")
    location_id = body.get("location_id")
    pricing_type = body.get("pricing_type")
    amount = body.get("amount")
    if not activity_id or not location_id or not pricing_type or amount is None:
        raise ValueError("activity_id, location_id, pricing_type, and amount are required")

    pricing_enum = PricingType(pricing_type)
    sessions_count = body.get("sessions_count")
    if pricing_enum == PricingType.PER_SESSIONS and not sessions_count:
        raise ValueError("sessions_count is required for per_sessions pricing")

    return ActivityPricing(
        activity_id=_parse_uuid(activity_id),
        location_id=_parse_uuid(location_id),
        pricing_type=pricing_enum,
        amount=Decimal(str(amount)),
        currency=body.get("currency") or "HKD",
        sessions_count=sessions_count,
    )


def _update_pricing(
    session: Session,
    entity: ActivityPricing,
    body: dict[str, Any],
) -> ActivityPricing:
    """Update activity pricing."""

    if "pricing_type" in body:
        entity.pricing_type = PricingType(body["pricing_type"])
    if "amount" in body:
        entity.amount = Decimal(str(body["amount"]))
    if "currency" in body:
        entity.currency = body["currency"]
    if "sessions_count" in body:
        entity.sessions_count = body["sessions_count"]
    return entity


def _serialize_pricing(entity: ActivityPricing) -> dict[str, Any]:
    """Serialize pricing."""

    return {
        "id": str(entity.id),
        "activity_id": str(entity.activity_id),
        "location_id": str(entity.location_id),
        "pricing_type": entity.pricing_type.value,
        "amount": entity.amount,
        "currency": entity.currency,
        "sessions_count": entity.sessions_count,
    }


def _create_schedule(session: Session, body: dict[str, Any]) -> ActivitySchedule:
    """Create activity schedule."""

    activity_id = body.get("activity_id")
    location_id = body.get("location_id")
    schedule_type = body.get("schedule_type")
    if not activity_id or not location_id or not schedule_type:
        raise ValueError("activity_id, location_id, and schedule_type are required")

    schedule_enum = ScheduleType(schedule_type)
    schedule = ActivitySchedule(
        activity_id=_parse_uuid(activity_id),
        location_id=_parse_uuid(location_id),
        schedule_type=schedule_enum,
        languages=_parse_languages(body.get("languages")),
    )
    _apply_schedule_fields(schedule, body, update_only=False)
    return schedule


def _update_schedule(
    session: Session,
    entity: ActivitySchedule,
    body: dict[str, Any],
) -> ActivitySchedule:
    """Update activity schedule."""

    if "schedule_type" in body:
        entity.schedule_type = ScheduleType(body["schedule_type"])
    if "languages" in body:
        entity.languages = _parse_languages(body["languages"])
    _apply_schedule_fields(entity, body, update_only=True)
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
        entity.start_at_utc = _parse_datetime(body.get("start_at_utc"))
    if not update_only or "end_at_utc" in body:
        entity.end_at_utc = _parse_datetime(body.get("end_at_utc"))


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


def _parse_languages(value: Any) -> list[str]:
    """Parse languages from JSON."""

    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    raise ValueError("languages must be a list or comma-separated string")


def _set_if_present(
    entity: ActivitySchedule,
    field_name: str,
    body: dict[str, Any],
    update_only: bool,
) -> None:
    """Set a field on the entity if present in body or create mode."""

    if not update_only or field_name in body:
        setattr(entity, field_name, body.get(field_name))


_RESOURCE_CONFIG = {
    "organizations": ResourceConfig(
        name="organizations",
        model=Organization,
        serializer=_serialize_organization,
        create_handler=_create_organization,
        update_handler=_update_organization,
    ),
    "locations": ResourceConfig(
        name="locations",
        model=Location,
        serializer=_serialize_location,
        create_handler=_create_location,
        update_handler=_update_location,
    ),
    "activities": ResourceConfig(
        name="activities",
        model=Activity,
        serializer=_serialize_activity,
        create_handler=_create_activity,
        update_handler=_update_activity,
    ),
    "pricing": ResourceConfig(
        name="pricing",
        model=ActivityPricing,
        serializer=_serialize_pricing,
        create_handler=_create_pricing,
        update_handler=_update_pricing,
    ),
    "schedules": ResourceConfig(
        name="schedules",
        model=ActivitySchedule,
        serializer=_serialize_schedule,
        create_handler=_create_schedule,
        update_handler=_update_schedule,
    ),
}
