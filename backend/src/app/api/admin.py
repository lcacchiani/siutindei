"""Admin CRUD API handlers.

This module provides admin CRUD operations using the repository pattern
for cleaner separation of concerns and better testability.
"""

from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from typing import Callable
from typing import Mapping
from typing import Optional
from typing import Protocol
from typing import Sequence
from typing import Tuple
from typing import Type
from urllib.parse import urlparse
from uuid import UUID, uuid4

import boto3
from psycopg.types.range import Range
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import Activity
from app.db.models import ActivityPricing
from app.db.models import ActivitySchedule
from app.db.models import Location
from app.db.models import Organization
from app.db.models import PricingType
from app.db.models import ScheduleType
from app.db.repositories import (
    ActivityPricingRepository,
    ActivityRepository,
    ActivityScheduleRepository,
    LocationRepository,
    OrganizationRepository,
)
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response, parse_datetime, parse_int
from app.utils.logging import configure_logging, get_logger, set_request_context


class RepositoryProtocol(Protocol):
    """Protocol for repository classes used in ResourceConfig."""

    def __init__(self, session: Session) -> None: ...

    def get_by_id(self, entity_id: UUID) -> Any: ...

    def get_all(
        self, limit: int = 50, cursor: Optional[UUID] = None
    ) -> Sequence[Any]: ...

    def create(self, entity: Any) -> Any: ...

    def update(self, entity: Any) -> Any: ...

    def delete(self, entity: Any) -> None: ...


# Configure logging on module load
configure_logging()
logger = get_logger(__name__)


@dataclass(frozen=True)
class ResourceConfig:
    """Configuration for admin resources."""

    name: str
    model: Type[Any]
    repository_class: Type[RepositoryProtocol]
    serializer: Callable[[Any], dict[str, Any]]
    create_handler: Callable[..., Any]
    update_handler: Callable[..., Any]


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle admin CRUD requests."""

    # Set request context for logging
    request_id = event.get("requestContext", {}).get("requestId", "")
    set_request_context(req_id=request_id)

    if not _is_admin(event):
        logger.warning("Unauthorized admin access attempt")
        return json_response(403, {"error": "Forbidden"}, event=event)

    method = event.get("httpMethod", "")
    path = event.get("path", "")
    resource, resource_id, sub_resource = _parse_path(path)

    logger.info(
        f"Admin request: {method} {path}",
        extra={"resource": resource, "resource_id": resource_id},
    )

    if resource == "users" and sub_resource == "groups":
        return _handle_user_group(event, method, resource_id)
    if resource == "organizations" and sub_resource == "pictures":
        return _handle_organization_pictures(event, method, resource_id)

    config = _RESOURCE_CONFIG.get(resource)
    if not config:
        return json_response(404, {"error": "Not found"}, event=event)

    try:
        if method == "GET":
            return _handle_get(event, config, resource_id)
        if method == "POST":
            return _handle_post(event, config)
        if method == "PUT":
            return _handle_put(event, config, resource_id)
        if method == "DELETE":
            return _handle_delete(event, config, resource_id)
        return json_response(405, {"error": "Method not allowed"}, event=event)
    except ValidationError as exc:
        logger.warning(f"Validation error: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except NotFoundError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except ValueError as exc:
        logger.warning(f"Value error: {exc}")
        return json_response(400, {"error": str(exc)}, event=event)
    except Exception as exc:  # pragma: no cover
        logger.exception("Unexpected error in admin handler")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


def _handle_get(
    event: Mapping[str, Any],
    config: ResourceConfig,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle GET requests for admin resources using repository."""

    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 200:
        raise ValidationError("limit must be between 1 and 200", field="limit")

    with Session(get_engine()) as session:
        repo = config.repository_class(session)

        if resource_id:
            entity = repo.get_by_id(_parse_uuid(resource_id))
            if entity is None:
                raise NotFoundError(config.name, resource_id)
            return json_response(200, config.serializer(entity), event=event)

        cursor = _parse_cursor(_query_param(event, "cursor"))
        rows = repo.get_all(limit=limit + 1, cursor=cursor)
        has_more = len(rows) > limit
        trimmed = list(rows)[:limit]
        next_cursor = _encode_cursor(trimmed[-1].id) if has_more and trimmed else None

        return json_response(
            200,
            {
                "items": [config.serializer(row) for row in trimmed],
                "next_cursor": next_cursor,
            },
            event=event,
        )


def _handle_post(event: Mapping[str, Any], config: ResourceConfig) -> dict[str, Any]:
    """Handle POST requests for admin resources using repository."""

    body = _parse_body(event)
    with Session(get_engine()) as session:
        repo = config.repository_class(session)
        entity = config.create_handler(repo, body)
        repo.create(entity)
        session.commit()
        session.refresh(entity)
        logger.info(f"Created {config.name}: {entity.id}")
        return json_response(201, config.serializer(entity), event=event)


def _handle_put(
    event: Mapping[str, Any],
    config: ResourceConfig,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle PUT requests for admin resources using repository."""

    if not resource_id:
        raise ValidationError("Resource id is required", field="id")

    body = _parse_body(event)
    with Session(get_engine()) as session:
        repo = config.repository_class(session)
        entity = repo.get_by_id(_parse_uuid(resource_id))
        if entity is None:
            raise NotFoundError(config.name, resource_id)
        updated = config.update_handler(repo, entity, body)
        repo.update(updated)
        session.commit()
        session.refresh(updated)
        logger.info(f"Updated {config.name}: {resource_id}")
        return json_response(200, config.serializer(updated), event=event)


def _handle_delete(
    event: Mapping[str, Any],
    config: ResourceConfig,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle DELETE requests for admin resources using repository."""

    if not resource_id:
        raise ValidationError("Resource id is required", field="id")

    with Session(get_engine()) as session:
        repo = config.repository_class(session)
        entity = repo.get_by_id(_parse_uuid(resource_id))
        if entity is None:
            raise NotFoundError(config.name, resource_id)
        repo.delete(entity)
        session.commit()
        logger.info(f"Deleted {config.name}: {resource_id}")
        return json_response(204, {}, event=event)


# --- Request parsing helpers ---


def _parse_body(event: Mapping[str, Any]) -> dict[str, Any]:
    """Parse JSON request body."""

    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    if not raw:
        raise ValidationError("Request body is required")
    return json.loads(raw)


def _parse_path(path: str) -> Tuple[str, Optional[str], Optional[str]]:
    """Parse resource name and id from the request path."""

    parts = [segment for segment in path.split("/") if segment]
    parts = _strip_version_prefix(parts)
    if len(parts) < 2 or parts[0] != "admin":
        return "", None, None
    resource = parts[1]
    resource_id = parts[2] if len(parts) > 2 else None
    sub_resource = parts[3] if len(parts) > 3 else None
    return resource, resource_id, sub_resource


def _strip_version_prefix(parts: list[str]) -> list[str]:
    """Drop an optional version prefix from path segments."""

    if parts and _is_version_segment(parts[0]):
        return parts[1:]
    return parts


def _is_version_segment(segment: str) -> bool:
    """Return True if the path segment matches v{number}."""

    return segment.startswith("v") and segment[1:].isdigit()


def _query_param(event: Mapping[str, Any], name: str) -> Optional[str]:
    """Return a query parameter value."""

    params = event.get("queryStringParameters") or {}
    return params.get(name)


def _parse_uuid(value: str) -> UUID:
    """Parse a UUID string."""

    try:
        return UUID(value)
    except (ValueError, TypeError) as e:
        raise ValidationError(f"Invalid UUID: {value}", field="id") from e


# --- Authorization ---


def _is_admin(event: Mapping[str, Any]) -> bool:
    """Return True when request belongs to an admin user."""

    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    groups = claims.get("cognito:groups", "")
    admin_group = os.getenv("ADMIN_GROUP", "admin")
    return admin_group in groups.split(",") if groups else False


# --- User group management ---


def _handle_user_group(
    event: Mapping[str, Any],
    method: str,
    username: Optional[str],
) -> dict[str, Any]:
    """Handle user group assignment."""

    if not username:
        raise ValidationError("username is required", field="username")

    group_name = _parse_group_name(event)
    client = boto3.client("cognito-idp")
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    if method == "POST":
        client.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        logger.info(f"Added user {username} to group {group_name}")
        return json_response(200, {"status": "added", "group": group_name}, event=event)

    if method == "DELETE":
        client.admin_remove_user_from_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        logger.info(f"Removed user {username} from group {group_name}")
        return json_response(
            200, {"status": "removed", "group": group_name}, event=event
        )

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _handle_organization_pictures(
    event: Mapping[str, Any],
    method: str,
    organization_id: Optional[str],
) -> dict[str, Any]:
    """Handle organization picture uploads and deletions."""

    if not organization_id:
        raise ValidationError("organization id is required", field="id")

    org_uuid = _parse_uuid(organization_id)

    if method == "POST":
        return _handle_picture_upload(event, org_uuid)
    if method == "DELETE":
        return _handle_picture_delete(event, org_uuid)
    return json_response(405, {"error": "Method not allowed"}, event=event)


def _handle_picture_upload(
    event: Mapping[str, Any],
    organization_id: UUID,
) -> dict[str, Any]:
    """Create a presigned URL for an organization picture."""

    body = _parse_body(event)
    if isinstance(body, dict):
        file_name = body.get("file_name")
        content_type = body.get("content_type")
    else:
        file_name = None
        content_type = None

    if not file_name:
        raise ValidationError("file_name is required", field="file_name")
    if not content_type:
        raise ValidationError("content_type is required", field="content_type")
    if not str(content_type).startswith("image/"):
        raise ValidationError(
            "content_type must be an image",
            field="content_type",
        )

    bucket = _require_env("ORGANIZATION_PICTURES_BUCKET")
    object_key = _build_picture_key(str(organization_id), str(file_name))
    base_url = _picture_base_url()

    client = boto3.client("s3")
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": object_key,
            "ContentType": str(content_type),
        },
        ExpiresIn=900,
    )

    return json_response(
        200,
        {
            "upload_url": upload_url,
            "picture_url": f"{base_url}/{object_key}",
            "object_key": object_key,
            "expires_in": 900,
        },
        event=event,
    )


def _handle_picture_delete(
    event: Mapping[str, Any],
    organization_id: UUID,
) -> dict[str, Any]:
    """Delete an organization picture from S3."""

    body = _parse_body(event)
    if isinstance(body, dict):
        object_key = body.get("object_key")
        picture_url = body.get("picture_url")
    else:
        object_key = None
        picture_url = None

    if object_key:
        key = str(object_key)
    elif picture_url:
        key = _extract_picture_key(str(picture_url))
    else:
        raise ValidationError(
            "picture_url or object_key is required",
            field="picture_url",
        )

    _validate_picture_key(str(organization_id), key)
    bucket = _require_env("ORGANIZATION_PICTURES_BUCKET")

    client = boto3.client("s3")
    client.delete_object(Bucket=bucket, Key=key)

    return json_response(204, {}, event=event)


def _build_picture_key(organization_id: str, file_name: str) -> str:
    """Build an S3 object key for a picture."""

    cleaned = _sanitize_picture_filename(file_name)
    base, extension = os.path.splitext(cleaned)
    trimmed_base = base[:40].strip("_") or "image"
    suffix = extension.lower() if extension else ""
    unique = uuid4().hex
    return f"organizations/{organization_id}/{unique}-" f"{trimmed_base}{suffix}"


def _sanitize_picture_filename(file_name: str) -> str:
    """Normalize user-supplied filenames."""

    trimmed = file_name.strip() or "image"
    return re.sub(r"[^A-Za-z0-9._-]", "_", trimmed)


def _picture_base_url() -> str:
    """Return the base URL for organization pictures."""

    return _require_env("ORGANIZATION_PICTURES_BASE_URL").rstrip("/")


def _extract_picture_key(picture_url: str) -> str:
    """Extract an object key from a picture URL."""

    base_url = _picture_base_url()
    parsed_url = urlparse(picture_url)
    base_parsed = urlparse(base_url)

    if parsed_url.netloc != base_parsed.netloc:
        raise ValidationError(
            "picture_url is not hosted in the images bucket",
            field="picture_url",
        )

    key = parsed_url.path.lstrip("/")
    if not key:
        raise ValidationError(
            "picture_url must include an object key",
            field="picture_url",
        )

    return key


def _validate_picture_key(organization_id: str, object_key: str) -> None:
    """Ensure the object key matches the organization prefix."""

    prefix = f"organizations/{organization_id}/"
    if not object_key.startswith(prefix):
        raise ValidationError(
            "picture_url does not match the organization",
            field="picture_url",
        )


def _parse_group_name(event: Mapping[str, Any]) -> str:
    """Parse the group name from the request."""

    raw = event.get("body") or ""
    if not raw:
        return os.getenv("ADMIN_GROUP") or "admin"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        body = {}
    group = body.get("group") if isinstance(body, dict) else None
    return group or os.getenv("ADMIN_GROUP") or "admin"


def _require_env(name: str) -> str:
    """Return a required environment variable value."""

    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


# --- Cursor encoding/decoding ---


def _parse_cursor(value: Optional[str]) -> Optional[UUID]:
    """Parse cursor for admin listing."""

    if value is None or value == "":
        return None
    try:
        payload = _decode_cursor(value)
        return UUID(payload["id"])
    except (ValueError, KeyError, TypeError) as exc:
        raise ValidationError("Invalid cursor", field="cursor") from exc


def _encode_cursor(value: Any) -> str:
    """Encode admin cursor."""

    payload = json.dumps({"id": str(value)}).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("utf-8")
    return encoded.rstrip("=")


def _decode_cursor(cursor: str) -> dict[str, Any]:
    """Decode admin cursor."""

    padding = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(cursor + padding)
    return json.loads(raw)


# --- Entity creation handlers (using repositories) ---


def _create_organization(
    repo: OrganizationRepository, body: dict[str, Any]
) -> Organization:
    """Create an organization."""

    name = _validate_string_length(
        body.get("name"), "name", MAX_NAME_LENGTH, required=True
    )
    description = _validate_string_length(
        body.get("description"), "description", MAX_DESCRIPTION_LENGTH
    )
    owner_id = _validate_owner_id(body.get("owner_id"))
    picture_urls = _parse_picture_urls(body.get("picture_urls"))
    if picture_urls:
        picture_urls = _validate_picture_urls(picture_urls)

    return Organization(
        name=name,
        description=description,
        owner_id=owner_id,
        picture_urls=picture_urls,
    )


def _update_organization(
    repo: OrganizationRepository,
    entity: Organization,
    body: dict[str, Any],
) -> Organization:
    """Update an organization."""

    if "name" in body:
        name = _validate_string_length(
            body["name"], "name", MAX_NAME_LENGTH, required=True
        )
        # _validate_string_length with required=True always returns str
        entity.name = name  # type: ignore[assignment]
    if "description" in body:
        entity.description = _validate_string_length(
            body["description"], "description", MAX_DESCRIPTION_LENGTH
        )
    if "owner_id" in body:
        entity.owner_id = _validate_owner_id(body["owner_id"])
    if "picture_urls" in body:
        picture_urls = _parse_picture_urls(body["picture_urls"])
        if picture_urls:
            picture_urls = _validate_picture_urls(picture_urls)
        entity.picture_urls = picture_urls
    return entity


def _serialize_organization(entity: Organization) -> dict[str, Any]:
    """Serialize an organization."""

    return {
        "id": str(entity.id),
        "name": entity.name,
        "description": entity.description,
        "owner_id": entity.owner_id,
        "picture_urls": entity.picture_urls or [],
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }


def _create_location(repo: LocationRepository, body: dict[str, Any]) -> Location:
    """Create a location."""

    org_id = body.get("org_id")
    if not org_id:
        raise ValidationError("org_id is required", field="org_id")

    district = _validate_string_length(
        body.get("district"), "district", MAX_DISTRICT_LENGTH, required=True
    )
    address = _validate_string_length(
        body.get("address"), "address", MAX_ADDRESS_LENGTH
    )

    lat = body.get("lat")
    lng = body.get("lng")
    _validate_coordinates(lat, lng)

    return Location(
        org_id=_parse_uuid(org_id),
        district=district,
        address=address,
        lat=lat,
        lng=lng,
    )


def _update_location(
    repo: LocationRepository,
    entity: Location,
    body: dict[str, Any],
) -> Location:
    """Update a location."""

    if "district" in body:
        district = _validate_string_length(
            body["district"], "district", MAX_DISTRICT_LENGTH, required=True
        )
        # _validate_string_length with required=True always returns str
        entity.district = district  # type: ignore[assignment]
    if "address" in body:
        entity.address = _validate_string_length(
            body["address"], "address", MAX_ADDRESS_LENGTH
        )

    lat = body.get("lat", entity.lat) if "lat" in body else entity.lat
    lng = body.get("lng", entity.lng) if "lng" in body else entity.lng

    if "lat" in body or "lng" in body:
        _validate_coordinates(lat, lng)

    if "lat" in body:
        entity.lat = body["lat"]
    if "lng" in body:
        entity.lng = body["lng"]
    return entity


def _validate_coordinates(lat: Any, lng: Any) -> None:
    """Validate latitude and longitude values."""

    if lat is not None:
        try:
            lat_val = float(lat)
            if not -90 <= lat_val <= 90:
                raise ValidationError(
                    "lat must be between -90 and 90",
                    field="lat",
                )
        except (ValueError, TypeError) as e:
            raise ValidationError("lat must be a valid number", field="lat") from e

    if lng is not None:
        try:
            lng_val = float(lng)
            if not -180 <= lng_val <= 180:
                raise ValidationError(
                    "lng must be between -180 and 180",
                    field="lng",
                )
        except (ValueError, TypeError) as e:
            raise ValidationError("lng must be a valid number", field="lng") from e


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


def _create_activity(repo: ActivityRepository, body: dict[str, Any]) -> Activity:
    """Create an activity."""

    org_id = body.get("org_id")
    if not org_id:
        raise ValidationError("org_id is required", field="org_id")

    name = _validate_string_length(
        body.get("name"), "name", MAX_NAME_LENGTH, required=True
    )
    description = _validate_string_length(
        body.get("description"), "description", MAX_DESCRIPTION_LENGTH
    )

    age_min = body.get("age_min")
    age_max = body.get("age_max")
    if age_min is None or age_max is None:
        raise ValidationError("age_min and age_max are required")

    _validate_age_range(age_min, age_max)
    age_range = Range(int(age_min), int(age_max), bounds="[]")

    return Activity(
        org_id=_parse_uuid(org_id),
        name=name,
        description=description,
        age_range=age_range,
    )


def _update_activity(
    repo: ActivityRepository,
    entity: Activity,
    body: dict[str, Any],
) -> Activity:
    """Update an activity."""

    if "name" in body:
        name = _validate_string_length(
            body["name"], "name", MAX_NAME_LENGTH, required=True
        )
        # _validate_string_length with required=True always returns str
        entity.name = name  # type: ignore[assignment]
    if "description" in body:
        entity.description = _validate_string_length(
            body["description"], "description", MAX_DESCRIPTION_LENGTH
        )
    if "age_min" in body or "age_max" in body:
        age_min = body.get("age_min")
        age_max = body.get("age_max")
        if age_min is None or age_max is None:
            raise ValidationError("age_min and age_max are required together")
        _validate_age_range(age_min, age_max)
        entity.age_range = Range(int(age_min), int(age_max), bounds="[]")
    return entity


def _validate_age_range(age_min: Any, age_max: Any) -> None:
    """Validate age range values."""

    try:
        age_min_val = int(age_min)
        age_max_val = int(age_max)
    except (ValueError, TypeError) as e:
        raise ValidationError("age_min and age_max must be valid integers") from e

    if age_min_val < 0:
        raise ValidationError(
            "age_min must be at least 0",
            field="age_min",
        )
    if age_max_val > 120:
        raise ValidationError(
            "age_max must be at most 120",
            field="age_max",
        )
    if age_min_val >= age_max_val:
        raise ValidationError("age_min must be less than age_max")


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


def _create_pricing(
    repo: ActivityPricingRepository, body: dict[str, Any]
) -> ActivityPricing:
    """Create activity pricing."""

    activity_id = body.get("activity_id")
    location_id = body.get("location_id")
    pricing_type = body.get("pricing_type")
    amount = body.get("amount")
    if not activity_id or not location_id or not pricing_type or amount is None:
        raise ValidationError(
            "activity_id, location_id, pricing_type, and amount are required"
        )

    _validate_pricing_amount(amount)
    currency = _validate_currency(body.get("currency") or "HKD")

    pricing_enum = PricingType(pricing_type)
    sessions_count = body.get("sessions_count")
    if pricing_enum == PricingType.PER_SESSIONS:
        if sessions_count is None:
            raise ValidationError("sessions_count is required for per_sessions pricing")
        _validate_sessions_count(sessions_count)
    else:
        sessions_count = None

    return ActivityPricing(
        activity_id=_parse_uuid(activity_id),
        location_id=_parse_uuid(location_id),
        pricing_type=pricing_enum,
        amount=Decimal(str(amount)),
        currency=currency,
        sessions_count=sessions_count,
    )


def _update_pricing(
    repo: ActivityPricingRepository,
    entity: ActivityPricing,
    body: dict[str, Any],
) -> ActivityPricing:
    """Update activity pricing."""

    if "pricing_type" in body:
        entity.pricing_type = PricingType(body["pricing_type"])
    if "amount" in body:
        _validate_pricing_amount(body["amount"])
        entity.amount = Decimal(str(body["amount"]))
    if "currency" in body:
        entity.currency = _validate_currency(body["currency"])
    if "sessions_count" in body:
        if body["sessions_count"] is not None:
            _validate_sessions_count(body["sessions_count"])
        entity.sessions_count = body["sessions_count"]
    if entity.pricing_type != PricingType.PER_SESSIONS:
        entity.sessions_count = None
    return entity


def _validate_pricing_amount(amount: Any) -> None:
    """Validate pricing amount."""

    try:
        amount_val = Decimal(str(amount))
    except Exception as e:
        raise ValidationError(
            "amount must be a valid number",
            field="amount",
        ) from e

    if amount_val < 0:
        raise ValidationError(
            "amount must be at least 0",
            field="amount",
        )


def _validate_sessions_count(sessions_count: Any) -> None:
    """Validate sessions count."""

    try:
        count = int(sessions_count)
    except (ValueError, TypeError) as e:
        raise ValidationError(
            "sessions_count must be a valid integer",
            field="sessions_count",
        ) from e

    if count <= 0:
        raise ValidationError(
            "sessions_count must be greater than 0",
            field="sessions_count",
        )


# --- Security validation functions ---

# Maximum string lengths to prevent DoS attacks
MAX_NAME_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 5000
MAX_ADDRESS_LENGTH = 500
MAX_DISTRICT_LENGTH = 100
MAX_URL_LENGTH = 2048
MAX_LANGUAGE_CODE_LENGTH = 10
MAX_LANGUAGES_COUNT = 20
MAX_PICTURE_URLS_COUNT = 20

# Valid ISO 4217 currency codes (common ones)
VALID_CURRENCIES = frozenset(
    [
        "HKD",
        "USD",
        "EUR",
        "GBP",
        "CNY",
        "JPY",
        "SGD",
        "AUD",
        "CAD",
        "CHF",
        "NZD",
        "TWD",
        "KRW",
        "THB",
        "MYR",
        "PHP",
        "IDR",
        "INR",
        "VND",
    ]
)

# Valid ISO 639-1 language codes (common ones)
VALID_LANGUAGE_CODES = frozenset(
    [
        "en",
        "zh",
        "ja",
        "ko",
        "fr",
        "de",
        "es",
        "pt",
        "it",
        "ru",
        "ar",
        "hi",
        "th",
        "vi",
        "id",
        "ms",
        "tl",
        "nl",
        "pl",
        "tr",
        "yue",  # Cantonese
    ]
)


def _validate_string_length(
    value: Any,
    field_name: str,
    max_length: int,
    required: bool = False,
) -> Optional[str]:
    """Validate and sanitize a string input.

    Args:
        value: The string value to validate.
        field_name: Name of the field for error messages.
        max_length: Maximum allowed length.
        required: Whether the field is required.

    Returns:
        The sanitized string, or None if empty/None.

    Raises:
        ValidationError: If validation fails.
    """
    if value is None:
        if required:
            raise ValidationError(f"{field_name} is required", field=field_name)
        return None

    if not isinstance(value, str):
        value = str(value)

    # Strip whitespace
    value = value.strip()

    if not value:
        if required:
            raise ValidationError(f"{field_name} is required", field=field_name)
        return None

    if len(value) > max_length:
        raise ValidationError(
            f"{field_name} must be at most {max_length} characters",
            field=field_name,
        )

    return value


def _validate_url(url: str, field_name: str = "url") -> str:
    """Validate a URL string.

    Args:
        url: The URL to validate.
        field_name: Name of the field for error messages.

    Returns:
        The validated URL.

    Raises:
        ValidationError: If the URL is invalid.
    """
    if len(url) > MAX_URL_LENGTH:
        raise ValidationError(
            f"{field_name} must be at most {MAX_URL_LENGTH} characters",
            field=field_name,
        )

    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ValidationError(
                f"{field_name} must use http or https scheme",
                field=field_name,
            )
        if not parsed.netloc:
            raise ValidationError(
                f"{field_name} must have a valid domain",
                field=field_name,
            )
    except Exception as e:
        if isinstance(e, ValidationError):
            raise
        raise ValidationError(
            f"{field_name} is not a valid URL",
            field=field_name,
        ) from e

    return url


def _validate_picture_urls(urls: list[str]) -> list[str]:
    """Validate a list of picture URLs.

    Args:
        urls: List of URLs to validate.

    Returns:
        The validated list of URLs.

    Raises:
        ValidationError: If validation fails.
    """
    if len(urls) > MAX_PICTURE_URLS_COUNT:
        raise ValidationError(
            f"picture_urls cannot have more than {MAX_PICTURE_URLS_COUNT} items",
            field="picture_urls",
        )

    validated = []
    for i, url in enumerate(urls):
        if url and url.strip():  # Skip empty or whitespace-only strings
            validated.append(_validate_url(url.strip(), f"picture_urls[{i}]"))
    return validated


def _validate_currency(currency: str) -> str:
    """Validate a currency code.

    Args:
        currency: The currency code to validate.

    Returns:
        The validated currency code (uppercase).

    Raises:
        ValidationError: If the currency is invalid.
    """
    if not currency:
        return "HKD"  # Default

    currency = currency.strip().upper()

    if currency not in VALID_CURRENCIES:
        raise ValidationError(
            "currency must be a valid ISO 4217 code (e.g., HKD, USD, EUR)",
            field="currency",
        )

    return currency


def _validate_owner_id(owner_id: Any) -> Optional[str]:
    """Validate and sanitize a Cognito user sub (owner_id).

    The owner_id should be a valid Cognito user sub, which is a UUID string.

    Args:
        owner_id: The owner_id value to validate.

    Returns:
        The validated owner_id string, or None if empty/None.

    Raises:
        ValidationError: If the owner_id format is invalid.
    """
    if owner_id is None:
        return None

    if not isinstance(owner_id, str):
        owner_id = str(owner_id)

    owner_id = owner_id.strip()

    if not owner_id:
        return None

    # Cognito user sub is a UUID, validate format
    try:
        # Parse and re-format to ensure consistent UUID format
        parsed = UUID(owner_id)
        return str(parsed)
    except (ValueError, TypeError) as e:
        raise ValidationError(
            "owner_id must be a valid UUID (Cognito user sub)",
            field="owner_id",
        ) from e


def _validate_language_code(code: str, field_name: str = "language") -> str:
    """Validate a language code.

    Args:
        code: The language code to validate.
        field_name: Name of the field for error messages.

    Returns:
        The validated language code (lowercase).

    Raises:
        ValidationError: If the language code is invalid.
    """
    if not code:
        raise ValidationError(f"{field_name} cannot be empty", field=field_name)

    code = code.strip().lower()

    if len(code) > MAX_LANGUAGE_CODE_LENGTH:
        raise ValidationError(
            f"{field_name} must be at most {MAX_LANGUAGE_CODE_LENGTH} characters",
            field=field_name,
        )

    if code not in VALID_LANGUAGE_CODES:
        raise ValidationError(
            f"{field_name} must be a valid ISO 639-1 language code (e.g., en, zh)",
            field=field_name,
        )

    return code


def _validate_languages(languages: list[str]) -> list[str]:
    """Validate a list of language codes.

    Args:
        languages: List of language codes to validate.

    Returns:
        The validated list of language codes.

    Raises:
        ValidationError: If validation fails.
    """
    if len(languages) > MAX_LANGUAGES_COUNT:
        raise ValidationError(
            f"languages cannot have more than {MAX_LANGUAGES_COUNT} items",
            field="languages",
        )

    validated = []
    seen = set()
    for i, lang in enumerate(languages):
        if lang and lang.strip():  # Skip empty or whitespace-only strings
            code = _validate_language_code(lang.strip(), f"languages[{i}]")
            if code not in seen:
                validated.append(code)
                seen.add(code)
    return validated


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


def _create_schedule(
    repo: ActivityScheduleRepository, body: dict[str, Any]
) -> ActivitySchedule:
    """Create activity schedule."""

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
    """Parse and validate languages from JSON."""

    if value is None:
        return []
    if isinstance(value, list):
        languages = [str(item) for item in value if item]
    elif isinstance(value, str):
        languages = [item.strip() for item in value.split(",") if item.strip()]
    else:
        raise ValidationError(
            "languages must be a list or comma-separated string", field="languages"
        )

    # Validate the language codes
    return _validate_languages(languages)


def _parse_picture_urls(value: Any) -> list[str]:
    """Parse picture URLs from JSON."""

    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    raise ValidationError(
        "picture_urls must be a list or comma-separated string",
        field="picture_urls",
    )


def _set_if_present(
    entity: ActivitySchedule,
    field_name: str,
    body: dict[str, Any],
    update_only: bool,
) -> None:
    """Set a field on the entity if present in body or create mode."""

    if not update_only or field_name in body:
        setattr(entity, field_name, body.get(field_name))


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

    # Validate start_minutes_utc < end_minutes_utc
    if (
        schedule.start_minutes_utc is not None
        and schedule.end_minutes_utc is not None
        and schedule.start_minutes_utc >= schedule.end_minutes_utc
    ):
        raise ValidationError(
            "start_minutes_utc must be less than end_minutes_utc",
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


# --- Resource configuration ---

_RESOURCE_CONFIG = {
    "organizations": ResourceConfig(
        name="organizations",
        model=Organization,
        repository_class=OrganizationRepository,
        serializer=_serialize_organization,
        create_handler=_create_organization,
        update_handler=_update_organization,
    ),
    "locations": ResourceConfig(
        name="locations",
        model=Location,
        repository_class=LocationRepository,
        serializer=_serialize_location,
        create_handler=_create_location,
        update_handler=_update_location,
    ),
    "activities": ResourceConfig(
        name="activities",
        model=Activity,
        repository_class=ActivityRepository,
        serializer=_serialize_activity,
        create_handler=_create_activity,
        update_handler=_update_activity,
    ),
    "pricing": ResourceConfig(
        name="pricing",
        model=ActivityPricing,
        repository_class=ActivityPricingRepository,
        serializer=_serialize_pricing,
        create_handler=_create_pricing,
        update_handler=_update_pricing,
    ),
    "schedules": ResourceConfig(
        name="schedules",
        model=ActivitySchedule,
        repository_class=ActivityScheduleRepository,
        serializer=_serialize_schedule,
        create_handler=_create_schedule,
        update_handler=_update_schedule,
    ),
}
