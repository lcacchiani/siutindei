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
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import Activity
from app.db.models import ActivityPricing
from app.db.models import ActivitySchedule
from app.db.models import Location
from app.db.models import Organization
from app.db.models import OrganizationAccessRequest
from app.db.models import PricingType
from app.db.models import ScheduleType
from app.db.repositories import (
    ActivityPricingRepository,
    ActivityRepository,
    ActivityScheduleRepository,
    LocationRepository,
    OrganizationRepository,
    OrganizationAccessRequestRepository,
)
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response, parse_datetime, parse_int
from app.utils.logging import configure_logging, get_logger, set_request_context
from app.utils.responses import validate_content_type


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
    # Optional: different update handler for manager routes (e.g., to restrict fields)
    manager_update_handler: Optional[Callable[..., Any]] = None


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle admin CRUD requests."""

    # Set request context for logging
    request_id = event.get("requestContext", {}).get("requestId", "")
    set_request_context(req_id=request_id)

    method = event.get("httpMethod", "")
    path = event.get("path", "")
    base_path, resource, resource_id, sub_resource = _parse_path(path)

    # SECURITY: Validate Content-Type for requests with bodies
    try:
        validate_content_type(event)
    except ValidationError as exc:
        logger.warning(f"Content-Type validation failed: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)

    logger.info(
        f"Admin request: {method} {path}",
        extra={
            "base_path": base_path,
            "resource": resource,
            "resource_id": resource_id,
        },
    )

    # Handle /v1/user/... routes (for any logged-in user)
    if base_path == "user":
        return _handle_user_routes(event, method, resource, resource_id)

    # Handle /v1/manager/... routes (for users in 'manager' or 'admin' group)
    if base_path == "manager":
        return _handle_manager_routes(event, method, resource, resource_id)

    # All /v1/admin/... routes require admin access
    if base_path != "admin":
        return json_response(404, {"error": "Not found"}, event=event)

    if not _is_admin(event):
        logger.warning("Unauthorized admin access attempt")
        return json_response(403, {"error": "Forbidden"}, event=event)

    # Special admin routes
    if resource == "users" and sub_resource == "groups":
        return _handle_user_group(event, method, resource_id)
    if resource == "organizations" and sub_resource == "media":
        return _handle_organization_media(event, method, resource_id)
    if resource == "cognito-users" and method == "GET":
        return _handle_list_cognito_users(event)
    if resource == "cognito-users" and method == "DELETE" and resource_id:
        return _safe_handler(
            lambda: _handle_delete_cognito_user(event, resource_id),
            event,
        )
    if resource == "access-requests":
        return _handle_admin_access_requests(event, method, resource_id)

    # Standard admin CRUD routes (no ownership filtering)
    config = _RESOURCE_CONFIG.get(resource)
    if not config:
        return json_response(404, {"error": "Not found"}, event=event)

    return _safe_handler(
        lambda: _handle_crud(event, method, config, resource_id),
        event,
    )


# --- Common Error Handling ---


def _safe_handler(
    handler: Callable[[], dict[str, Any]],
    event: Mapping[str, Any],
) -> dict[str, Any]:
    """Execute a handler with common error handling.

    Args:
        handler: The handler function to execute.
        event: The Lambda event for response formatting.

    Returns:
        API Gateway response.
    """
    try:
        return handler()
    except ValidationError as exc:
        logger.warning(f"Validation error: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except NotFoundError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except ValueError as exc:
        logger.warning(f"Value error: {exc}")
        return json_response(400, {"error": str(exc)}, event=event)
    except Exception as exc:  # pragma: no cover
        logger.exception("Unexpected error in handler")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


# --- Unified CRUD Handlers ---
# These handlers work for both admin (full access) and manager (filtered) routes.
# When managed_org_ids is None, no filtering is applied (admin mode).
# When managed_org_ids is set, resources are filtered by management (manager mode).


def _handle_crud(
    event: Mapping[str, Any],
    method: str,
    config: ResourceConfig,
    resource_id: Optional[str],
    managed_org_ids: Optional[set[str]] = None,
) -> dict[str, Any]:
    """Unified CRUD handler for both admin and manager routes.

    Args:
        event: The Lambda event.
        method: HTTP method (GET, POST, PUT, DELETE).
        config: Resource configuration.
        resource_id: Optional specific resource ID.
        managed_org_ids: If set, filter/validate by organization management.

    Returns:
        API Gateway response.
    """
    with Session(get_engine()) as session:
        if method == "GET":
            return _crud_get(event, session, config, resource_id, managed_org_ids)
        if method == "POST":
            return _crud_post(event, session, config, managed_org_ids)
        if method == "PUT":
            return _crud_put(event, session, config, resource_id, managed_org_ids)
        if method == "DELETE":
            return _crud_delete(event, session, config, resource_id, managed_org_ids)

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _crud_get(
    event: Mapping[str, Any],
    session: Session,
    config: ResourceConfig,
    resource_id: Optional[str],
    managed_org_ids: Optional[set[str]] = None,
) -> dict[str, Any]:
    """Handle GET requests with optional management filtering."""
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 200:
        raise ValidationError("limit must be between 1 and 200", field="limit")

    repo = config.repository_class(session)

    if resource_id:
        entity = repo.get_by_id(_parse_uuid(resource_id))
        if entity is None:
            raise NotFoundError(config.name, resource_id)
        # Check management if filtering is enabled
        if managed_org_ids is not None:
            entity_org_id = _get_entity_org_id(entity, session)
            if entity_org_id not in managed_org_ids:
                return json_response(
                    403,
                    {"error": "You don't have access to this resource"},
                    event=event,
                )
        return json_response(200, config.serializer(entity), event=event)

    # List resources
    cursor = _parse_cursor(_query_param(event, "cursor"))
    if managed_org_ids is not None:
        rows = _get_all_filtered_by_org(
            session, config, managed_org_ids, limit + 1, cursor
        )
    else:
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


def _crud_post(
    event: Mapping[str, Any],
    session: Session,
    config: ResourceConfig,
    managed_org_ids: Optional[set[str]] = None,
) -> dict[str, Any]:
    """Handle POST requests with optional management validation."""
    body = _parse_body(event)

    # Validate management if filtering is enabled
    if managed_org_ids is not None:
        org_id = _get_org_id_from_body(body, config.name)
        if org_id and org_id not in managed_org_ids:
            return json_response(
                403,
                {"error": "You don't have access to this organization"},
                event=event,
            )
        # For pricing/schedules, verify management through activity
        if config.name in ("pricing", "schedules"):
            activity_id = body.get("activity_id")
            if activity_id:
                activity_repo = ActivityRepository(session)
                activity = activity_repo.get_by_id(_parse_uuid(activity_id))
                if activity and str(activity.org_id) not in managed_org_ids:
                    return json_response(
                        403,
                        {"error": "You don't have access to this activity"},
                        event=event,
                    )

    repo = config.repository_class(session)
    entity = config.create_handler(repo, body)
    repo.create(entity)
    session.commit()
    session.refresh(entity)
    logger.info(f"Created {config.name}: {entity.id}")
    return json_response(201, config.serializer(entity), event=event)


def _crud_put(
    event: Mapping[str, Any],
    session: Session,
    config: ResourceConfig,
    resource_id: Optional[str],
    managed_org_ids: Optional[set[str]] = None,
) -> dict[str, Any]:
    """Handle PUT requests with optional management validation."""
    if not resource_id:
        raise ValidationError("Resource id is required", field="id")

    repo = config.repository_class(session)
    entity = repo.get_by_id(_parse_uuid(resource_id))
    if entity is None:
        raise NotFoundError(config.name, resource_id)

    # Check management if filtering is enabled
    if managed_org_ids is not None:
        entity_org_id = _get_entity_org_id(entity, session)
        if entity_org_id not in managed_org_ids:
            return json_response(
                403, {"error": "You don't have access to this resource"}, event=event
            )

    body = _parse_body(event)

    # Use manager-specific update handler if available and in manager mode
    if managed_org_ids is not None and config.manager_update_handler is not None:
        update_handler = config.manager_update_handler
    else:
        update_handler = config.update_handler

    updated = update_handler(repo, entity, body)
    repo.update(updated)
    session.commit()
    session.refresh(updated)
    logger.info(f"Updated {config.name}: {resource_id}")
    return json_response(200, config.serializer(updated), event=event)


def _crud_delete(
    event: Mapping[str, Any],
    session: Session,
    config: ResourceConfig,
    resource_id: Optional[str],
    managed_org_ids: Optional[set[str]] = None,
) -> dict[str, Any]:
    """Handle DELETE requests with optional management validation."""
    if not resource_id:
        raise ValidationError("Resource id is required", field="id")

    repo = config.repository_class(session)
    entity = repo.get_by_id(_parse_uuid(resource_id))
    if entity is None:
        raise NotFoundError(config.name, resource_id)

    # Check management if filtering is enabled
    if managed_org_ids is not None:
        entity_org_id = _get_entity_org_id(entity, session)
        if entity_org_id not in managed_org_ids:
            return json_response(
                403, {"error": "You don't have access to this resource"}, event=event
            )

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


def _parse_path(
    path: str,
) -> Tuple[str, str, Optional[str], Optional[str]]:
    """Parse base path, resource name, and id from the request path.

    Returns:
        Tuple of (base_path, resource, resource_id, sub_resource)
        base_path is either "admin", "manager", or "user"
    """
    parts = [segment for segment in path.split("/") if segment]
    parts = _strip_version_prefix(parts)

    if not parts:
        return "", "", None, None

    base_path = parts[0]

    # Handle /v1/admin/... paths
    if base_path == "admin":
        if len(parts) < 2:
            return base_path, "", None, None
        resource = parts[1]
        resource_id = parts[2] if len(parts) > 2 else None
        sub_resource = parts[3] if len(parts) > 3 else None
        return base_path, resource, resource_id, sub_resource

    # Handle /v1/manager/... paths
    if base_path == "manager":
        resource = parts[1] if len(parts) > 1 else ""
        resource_id = parts[2] if len(parts) > 2 else None
        sub_resource = parts[3] if len(parts) > 3 else None
        return base_path, resource, resource_id, sub_resource

    # Handle /v1/user/... paths
    if base_path == "user":
        resource = parts[1] if len(parts) > 1 else ""
        resource_id = parts[2] if len(parts) > 2 else None
        sub_resource = parts[3] if len(parts) > 3 else None
        return base_path, resource, resource_id, sub_resource

    return "", "", None, None


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


def _get_authorizer_context(event: Mapping[str, Any]) -> dict[str, Any]:
    """Extract authorizer context from the event.

    Supports both:
    - Lambda authorizers (context fields directly in authorizer)
    - Cognito User Pool authorizers (claims nested under authorizer.claims)
    """
    authorizer = event.get("requestContext", {}).get("authorizer", {})

    # Lambda authorizer puts context fields directly
    if "groups" in authorizer or "userSub" in authorizer:
        return {
            "groups": authorizer.get("groups", ""),
            "sub": authorizer.get("userSub", ""),
            "email": authorizer.get("email", ""),
        }

    # Cognito User Pool authorizer nests under "claims"
    claims = authorizer.get("claims", {})
    return {
        "groups": claims.get("cognito:groups", ""),
        "sub": claims.get("sub", ""),
        "email": claims.get("email", ""),
    }


def _is_admin(event: Mapping[str, Any]) -> bool:
    """Return True when request belongs to an admin user."""
    ctx = _get_authorizer_context(event)
    groups = ctx.get("groups", "")
    admin_group = os.getenv("ADMIN_GROUP", "admin")
    return admin_group in groups.split(",") if groups else False


def _is_manager(event: Mapping[str, Any]) -> bool:
    """Return True when request belongs to a manager user."""
    ctx = _get_authorizer_context(event)
    groups = ctx.get("groups", "")
    manager_group = os.getenv("MANAGER_GROUP", "manager")
    return manager_group in groups.split(",") if groups else False


def _get_user_sub(event: Mapping[str, Any]) -> Optional[str]:
    """Extract the user's Cognito sub (subject) from authorizer context."""
    ctx = _get_authorizer_context(event)
    return ctx.get("sub") or None


def _get_user_email(event: Mapping[str, Any]) -> Optional[str]:
    """Extract the user's email from authorizer context."""
    ctx = _get_authorizer_context(event)
    return ctx.get("email") or None


def _get_managed_organization_ids(event: Mapping[str, Any]) -> set[str]:
    """Get the IDs of organizations managed by the current user.

    Returns:
        Set of organization IDs (as strings) managed by the user.
    """
    user_sub = _get_user_sub(event)
    if not user_sub:
        return set()

    with Session(get_engine()) as session:
        repo = OrganizationRepository(session)
        orgs = repo.find_by_manager(user_sub)
        return {str(org.id) for org in orgs}


def _get_entity_org_id(entity: Any, session: Session) -> Optional[str]:
    """Get the organization ID for an entity.

    Works for:
    - Organization: the entity's own ID
    - Location, Activity: direct org_id field
    - Pricing, Schedule: through activity relationship

    Returns:
        The organization ID as a string, or None if not determinable.
    """
    # Organization entity - the org_id is the entity itself
    if isinstance(entity, Organization):
        return str(entity.id)

    # Direct org_id (Location, Activity)
    if hasattr(entity, "org_id"):
        return str(entity.org_id)

    # Through activity (Pricing, Schedule)
    if hasattr(entity, "activity_id"):
        activity_repo = ActivityRepository(session)
        activity = activity_repo.get_by_id(entity.activity_id)
        if activity:
            return str(activity.org_id)

    return None


def _get_org_id_from_body(body: dict[str, Any], resource_name: str) -> Optional[str]:
    """Extract the organization ID from a request body.

    For locations/activities, reads org_id directly.
    For pricing/schedules, would need to look up via activity_id (handled separately).

    Returns:
        The organization ID as a string, or None if not in body.
    """
    org_id = body.get("org_id")
    if org_id:
        return str(org_id)
    return None


def _get_all_filtered_by_org(
    session: Session,
    config: ResourceConfig,
    managed_org_ids: set[str],
    limit: int,
    cursor: Optional[UUID],
) -> Sequence[Any]:
    """Get all entities filtered by organization management.

    Args:
        session: Database session.
        config: Resource configuration.
        managed_org_ids: Set of managed organization IDs.
        limit: Maximum results to return.
        cursor: Optional pagination cursor.

    Returns:
        Sequence of entities belonging to the managed organizations.
    """
    model = config.model

    # Build base query based on model type
    if model == Organization:
        # Organization - filter by entity ID
        query = select(model).where(model.id.in_(managed_org_ids))
    elif hasattr(model, "org_id"):
        # Direct org_id (Location, Activity)
        query = select(model).where(model.org_id.in_(managed_org_ids))
    elif hasattr(model, "activity_id"):
        # Through activity (Pricing, Schedule)
        query = (
            select(model)
            .join(Activity, model.activity_id == Activity.id)
            .where(Activity.org_id.in_(managed_org_ids))
        )
    else:
        # Fallback - shouldn't happen for manager-accessible resources
        query = select(model)

    # Add cursor pagination
    if cursor:
        query = query.where(model.id > cursor)

    query = query.order_by(model.id).limit(limit)

    return session.execute(query).scalars().all()


# --- Manager-specific routes ---


def _handle_user_routes(
    event: Mapping[str, Any],
    method: str,
    resource: str,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle routes accessible to any logged-in Cognito user.

    User routes:
        /v1/user/access-request - Request access to become a manager
    """
    # Access request - any logged-in user can request
    if resource == "access-request":
        return _safe_handler(
            lambda: _handle_user_access_request(event, method),
            event,
        )

    return json_response(404, {"error": "Not found"}, event=event)


def _handle_manager_routes(
    event: Mapping[str, Any],
    method: str,
    resource: str,
    resource_id: Optional[str],
) -> dict[str, Any]:
    """Handle routes accessible to users in the 'manager' group.

    All manager routes filter data by organization management.

    Manager routes:
        /v1/manager/organizations - CRUD for managed organizations
        /v1/manager/locations - CRUD for locations in managed organizations
        /v1/manager/activities - CRUD for activities in managed organizations
        /v1/manager/pricing - CRUD for pricing in managed organizations
        /v1/manager/schedules - CRUD for schedules in managed organizations
    """
    # Check if user is in manager group (or admin group - admins can do everything)
    if not _is_manager(event) and not _is_admin(event):
        logger.warning("Unauthorized manager access attempt")
        return json_response(403, {"error": "Forbidden"}, event=event)

    # Resources that can be managed by managers
    manager_resources = {
        "organizations",
        "locations",
        "activities",
        "pricing",
        "schedules",
    }
    if resource not in manager_resources:
        return json_response(404, {"error": "Not found"}, event=event)

    # Get managed organization IDs for filtering
    managed_org_ids = _get_managed_organization_ids(event)

    # Handle no organizations case
    if not managed_org_ids:
        if method == "GET" and not resource_id:
            return json_response(200, {"items": [], "next_cursor": None}, event=event)
        return json_response(
            403, {"error": "You don't manage any organizations"}, event=event
        )

    # Get resource configuration
    config = _RESOURCE_CONFIG.get(resource)
    if not config:
        return json_response(404, {"error": "Not found"}, event=event)

    # Use unified CRUD handler with management filtering
    return _safe_handler(
        lambda: _handle_crud(event, method, config, resource_id, managed_org_ids),
        event,
    )


def _update_organization_for_manager(
    repo: OrganizationRepository,
    entity: Organization,
    body: dict[str, Any],
) -> Organization:
    """Update an organization for a manager (limited fields).

    Managers cannot change the manager_id field.
    The repo parameter is unused but included for signature compatibility.
    """
    del repo  # Unused, for signature compatibility
    if "name" in body:
        name = _validate_string_length(
            body["name"], "name", MAX_NAME_LENGTH, required=True
        )
        entity.name = name  # type: ignore[assignment]
    if "description" in body:
        entity.description = _validate_string_length(
            body["description"], "description", MAX_DESCRIPTION_LENGTH
        )
    if "media_urls" in body:
        media_urls = _parse_media_urls(body["media_urls"])
        if media_urls:
            media_urls = _validate_media_urls(media_urls)
        entity.media_urls = media_urls
    return entity


def _handle_user_access_request(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle user access request operations.

    Any logged-in user can request to become a manager of an organization.

    GET: Check if user has a pending access request
    POST: Submit a new access request (if none pending)

    POST requests are published to SNS for async processing via SQS.
    Requires MANAGER_REQUEST_TOPIC_ARN environment variable.
    """
    user_sub = _get_user_sub(event)
    user_email = _get_user_email(event)

    if not user_sub:
        return json_response(401, {"error": "User identity not found"}, event=event)

    if method == "GET":
        # Check if user has a pending request and return their organizations count
        with Session(get_engine()) as session:
            org_repo = OrganizationRepository(session)
            request_repo = OrganizationAccessRequestRepository(session)

            # Get user's organizations
            user_orgs = org_repo.find_by_manager(user_sub)

            # Check for pending request
            pending_request = request_repo.find_pending_by_requester(user_sub)

            return json_response(
                200,
                {
                    "has_pending_request": pending_request is not None,
                    "pending_request": _serialize_access_request(pending_request)
                    if pending_request
                    else None,
                    "organizations_count": len(user_orgs),
                },
                event=event,
            )

    if method == "POST":
        # Submit a new manager request
        body = _parse_body(event)

        # Validate request fields first (before any DB or SNS operations)
        # organization_name is required, so _validate_string_length will raise if None
        organization_name_validated = _validate_string_length(
            body.get("organization_name"),
            "organization_name",
            MAX_NAME_LENGTH,
            required=True,
        )
        # required=True guarantees non-None return, but mypy doesn't know this
        if organization_name_validated is None:
            raise ValidationError(
                "organization_name is required", field="organization_name"
            )
        organization_name: str = organization_name_validated
        request_message = _validate_string_length(
            body.get("request_message"),
            "request_message",
            MAX_DESCRIPTION_LENGTH,
            required=False,
        )

        # Require SNS topic ARN
        topic_arn = os.getenv("MANAGER_REQUEST_TOPIC_ARN")
        if not topic_arn:
            logger.error("MANAGER_REQUEST_TOPIC_ARN not configured")
            return json_response(
                500,
                {"error": "Service configuration error. Please contact support."},
                event=event,
            )

        with Session(get_engine()) as session:
            request_repo = OrganizationAccessRequestRepository(session)

            # Check if user already has a pending request
            existing = request_repo.find_pending_by_requester(user_sub)
            if existing:
                return json_response(
                    409,
                    {
                        "error": "You already have a pending access request",
                        "request": _serialize_access_request(existing),
                    },
                    event=event,
                )

            # Generate a unique progressive ticket ID
            ticket_id = _generate_ticket_id(session)

        # Publish to SNS for async processing
        return _publish_manager_request_to_sns(
            event=event,
            topic_arn=topic_arn,
            ticket_id=ticket_id,
            user_sub=user_sub,
            user_email=user_email or "unknown",
            organization_name=organization_name,
            request_message=request_message,
        )

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _publish_manager_request_to_sns(
    event: Mapping[str, Any],
    topic_arn: str,
    ticket_id: str,
    user_sub: str,
    user_email: str,
    organization_name: str,
    request_message: Optional[str],
) -> dict[str, Any]:
    """Publish manager request to SNS for async processing.

    The message is processed by an SQS-triggered Lambda that stores
    the request in the database and sends email notifications.

    Args:
        event: Lambda event for response formatting.
        topic_arn: SNS topic ARN to publish to.
        ticket_id: Generated ticket ID for the request.
        user_sub: Cognito user sub (subject) identifier.
        user_email: User's email address.
        organization_name: Name of requested organization.
        request_message: Optional message from the user.

    Returns:
        API Gateway response (202 Accepted).
    """
    sns_client = boto3.client("sns")

    try:
        sns_client.publish(
            TopicArn=topic_arn,
            Message=json.dumps(
                {
                    "event_type": "manager_request.submitted",
                    "ticket_id": ticket_id,
                    "requester_id": user_sub,
                    "requester_email": user_email,
                    "organization_name": organization_name,
                    "request_message": request_message,
                }
            ),
            MessageAttributes={
                "event_type": {
                    "DataType": "String",
                    "StringValue": "manager_request.submitted",
                },
            },
        )

        logger.info(f"Published manager request to SNS: {ticket_id}")

        return json_response(
            202,
            {
                "message": "Your request has been submitted and is being processed",
                "ticket_id": ticket_id,
            },
            event=event,
        )

    except Exception as exc:
        logger.exception(f"Failed to publish manager request to SNS: {exc}")
        return json_response(
            500,
            {"error": "Failed to submit request. Please try again."},
            event=event,
        )


def _generate_ticket_id(session: Session) -> str:
    """Generate a unique progressive ticket ID in format R + 5 digits.

    Queries the database for the highest existing ticket number and
    increments it by 1. Thread-safe due to database unique constraint.

    Args:
        session: SQLAlchemy database session for querying existing tickets.

    Returns:
        A new ticket ID like R00001, R00002, etc.
    """
    from sqlalchemy import text

    # Query the highest ticket number from existing requests
    result = session.execute(
        text(
            "SELECT MAX(CAST(SUBSTRING(ticket_id FROM 2) AS BIGINT)) "
            "FROM organization_access_requests "
            "WHERE ticket_id LIKE 'R%'"
        )
    ).scalar()

    # Start from 1 if no existing tickets, otherwise increment
    next_number = (result or 0) + 1

    return f"R{next_number:05d}"


def _serialize_access_request(
    request: Optional[OrganizationAccessRequest],
) -> Optional[dict[str, Any]]:
    """Serialize an access request for the API response."""
    if request is None:
        return None
    return {
        "id": str(request.id),
        "ticket_id": request.ticket_id,
        "organization_name": request.organization_name,
        "request_message": request.request_message,
        "status": request.status.value,
        "requester_email": request.requester_email,
        "requester_id": request.requester_id,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "reviewed_at": request.reviewed_at.isoformat() if request.reviewed_at else None,
        "reviewed_by": request.reviewed_by,
    }


# --- Admin access request management ---


def _handle_admin_access_requests(
    event: Mapping[str, Any],
    method: str,
    request_id: Optional[str],
) -> dict[str, Any]:
    """Handle admin access request management.

    GET: List all access requests (optionally filtered by status)
    PUT /{id}: Approve or reject an access request
    """
    try:
        if method == "GET":
            return _handle_list_access_requests(event)
        if method == "PUT" and request_id:
            return _handle_review_access_request(event, request_id)
        return json_response(405, {"error": "Method not allowed"}, event=event)
    except ValidationError as exc:
        logger.warning(f"Validation error: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except NotFoundError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except Exception as exc:
        logger.exception("Unexpected error in admin access requests handler")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


def _handle_list_access_requests(event: Mapping[str, Any]) -> dict[str, Any]:
    """List all access requests for admin review."""
    from app.db.models import AccessRequestStatus

    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 200:
        raise ValidationError("limit must be between 1 and 200", field="limit")

    status_filter = _query_param(event, "status")
    status = None
    if status_filter:
        try:
            status = AccessRequestStatus(status_filter)
        except ValueError:
            raise ValidationError(
                f"Invalid status: {status_filter}. Must be pending, approved, or rejected",
                field="status",
            )

    with Session(get_engine()) as session:
        repo = OrganizationAccessRequestRepository(session)
        cursor = _parse_cursor(_query_param(event, "cursor"))
        rows = repo.find_all(status=status, limit=limit + 1, cursor=cursor)
        has_more = len(rows) > limit
        trimmed = list(rows)[:limit]
        next_cursor = _encode_cursor(trimmed[-1].id) if has_more and trimmed else None

        return json_response(
            200,
            {
                "items": [_serialize_access_request(row) for row in trimmed],
                "next_cursor": next_cursor,
            },
            event=event,
        )


def _handle_review_access_request(
    event: Mapping[str, Any],
    request_id: str,
) -> dict[str, Any]:
    """Approve or reject an access request.

    When approving, the admin can either:
    - Assign an existing organization (organization_id)
    - Create a new organization (create_organization=True)

    In both cases, the requester becomes the manager of the organization
    and is added to the 'manager' Cognito group.
    """
    from datetime import datetime, timezone
    from app.db.models import AccessRequestStatus

    body = _parse_body(event)
    action = body.get("action")
    admin_message = body.get("message", "")

    if action not in ("approve", "reject"):
        raise ValidationError(
            "action must be 'approve' or 'reject'",
            field="action",
        )

    reviewer_sub = _get_user_sub(event)
    if not reviewer_sub:
        return json_response(401, {"error": "User identity not found"}, event=event)

    # For approval, validate organization options
    organization_id = body.get("organization_id")
    create_organization = body.get("create_organization", False)

    if action == "approve":
        if not organization_id and not create_organization:
            raise ValidationError(
                "When approving, you must either provide organization_id "
                "or set create_organization to true",
                field="organization_id",
            )
        if organization_id and create_organization:
            raise ValidationError(
                "Cannot both select an existing organization and create a new one",
                field="organization_id",
            )

    with Session(get_engine()) as session:
        repo = OrganizationAccessRequestRepository(session)
        request = repo.get_by_id(_parse_uuid(request_id))

        if request is None:
            raise NotFoundError("access_request", request_id)

        if request.status != AccessRequestStatus.PENDING:
            return json_response(
                409,
                {"error": f"Request has already been {request.status.value}"},
                event=event,
            )

        organization = None

        # Handle organization assignment/creation for approval
        if action == "approve":
            org_repo = OrganizationRepository(session)

            if organization_id:
                # Assign existing organization to the requester
                organization = org_repo.get_by_id(_parse_uuid(organization_id))
                if organization is None:
                    raise NotFoundError("organization", organization_id)

                # Update the manager to be the requester
                organization.manager_id = request.requester_id
                org_repo.update(organization)
                logger.info(
                    f"Assigned organization {organization_id} to user {request.requester_id}"
                )

            elif create_organization:
                # Create a new organization with the requested name
                organization = Organization(
                    name=request.organization_name,
                    description=None,
                    manager_id=request.requester_id,
                    media_urls=[],
                )
                org_repo.create(organization)
                logger.info(
                    f"Created organization '{request.organization_name}' "
                    f"for user {request.requester_id}"
                )

            # Add the user to the 'manager' Cognito group
            _add_user_to_manager_group(request.requester_id)

        # Update the request status
        new_status = (
            AccessRequestStatus.APPROVED
            if action == "approve"
            else AccessRequestStatus.REJECTED
        )
        request.status = new_status
        request.reviewed_at = datetime.now(timezone.utc)
        request.reviewed_by = reviewer_sub

        repo.update(request)
        session.commit()
        session.refresh(request)

        if organization:
            session.refresh(organization)

        logger.info(f"Access request {request_id} {action}d by {reviewer_sub}")

        # Send notification email to the requester
        _send_request_decision_email(request, action, admin_message)

        response_data: dict[str, Any] = {
            "message": f"Request has been {action}d",
            "request": _serialize_access_request(request),
        }

        if organization:
            response_data["organization"] = _serialize_organization(organization)

        return json_response(200, response_data, event=event)


def _send_request_decision_email(
    request: OrganizationAccessRequest,
    action: str,
    admin_message: str,
) -> None:
    """Send email notification to requester about their request decision.

    Email template is defined in app/templates/email_templates.py

    Args:
        request: The access request that was reviewed.
        action: Either 'approve' or 'reject'.
        admin_message: Optional message from the admin.
    """
    from app.templates import render_request_decision_email

    sender_email = os.getenv("SES_SENDER_EMAIL")

    if not sender_email:
        logger.warning("Email notification skipped: SES_SENDER_EMAIL not configured")
        return

    if not request.requester_email or request.requester_email == "unknown":
        logger.warning(
            f"Email notification skipped: No valid email for request {request.ticket_id}"
        )
        return

    try:
        ses_client = boto3.client("ses")

        email_content = render_request_decision_email(
            ticket_id=request.ticket_id,
            organization_name=request.organization_name,
            reviewed_at=request.reviewed_at.isoformat()
            if request.reviewed_at
            else "Unknown",
            action=action,
            admin_message=admin_message if admin_message else None,
        )

        ses_client.send_email(
            Source=sender_email,
            Destination={"ToAddresses": [request.requester_email]},
            Message={
                "Subject": {"Data": email_content.subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": email_content.body_text, "Charset": "UTF-8"},
                    "Html": {"Data": email_content.body_html, "Charset": "UTF-8"},
                },
            },
        )
        logger.info(
            f"Request decision email sent to {request.requester_email} for {request.ticket_id}"
        )
    except Exception as exc:
        # Don't fail the request if email fails
        logger.error(f"Failed to send request decision email: {exc}")


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
        # Invalidate user's session to force re-authentication with new permissions
        _invalidate_user_session(client, user_pool_id, username)
        logger.info(f"Added user {username} to group {group_name}")
        return json_response(200, {"status": "added", "group": group_name}, event=event)

    if method == "DELETE":
        client.admin_remove_user_from_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        # Invalidate user's session to force re-authentication with new permissions
        _invalidate_user_session(client, user_pool_id, username)
        logger.info(f"Removed user {username} from group {group_name}")
        return json_response(
            200, {"status": "removed", "group": group_name}, event=event
        )

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _invalidate_user_session(
    client: Any,
    user_pool_id: str,
    username: str,
) -> None:
    """Invalidate a user's session by signing them out globally.

    This forces the user to re-authenticate and get new tokens with
    updated permissions (e.g., after group membership changes).

    Args:
        client: The Cognito IDP client.
        user_pool_id: The Cognito user pool ID.
        username: The username of the user to sign out.
    """
    try:
        client.admin_user_global_sign_out(
            UserPoolId=user_pool_id,
            Username=username,
        )
        logger.info(f"Invalidated session for user: {username}")
    except Exception as exc:
        # Log but don't fail the operation if sign-out fails
        # The user may not have an active session
        logger.warning(f"Failed to invalidate session for user {username}: {exc}")


def _add_user_to_manager_group(user_sub: str) -> None:
    """Add a user to the 'manager' Cognito group.

    This is called when an access request is approved to grant the user
    manager permissions.

    Args:
        user_sub: The Cognito user's sub (subject) identifier.
    """
    try:
        client = boto3.client("cognito-idp")
        user_pool_id = _require_env("COGNITO_USER_POOL_ID")
        manager_group = os.getenv("MANAGER_GROUP", "manager")

        # First, we need to find the username from the sub
        # List users filtered by sub attribute
        response = client.list_users(
            UserPoolId=user_pool_id,
            Filter=f'sub = "{user_sub}"',
            Limit=1,
        )

        users = response.get("Users", [])
        if not users:
            logger.warning(f"Could not find Cognito user with sub: {user_sub}")
            return

        username = users[0].get("Username")
        if not username:
            logger.warning(f"User with sub {user_sub} has no username")
            return

        # Check if user is already in the manager group
        groups_response = client.admin_list_groups_for_user(
            UserPoolId=user_pool_id,
            Username=username,
        )
        existing_groups = [g["GroupName"] for g in groups_response.get("Groups", [])]

        if manager_group in existing_groups:
            logger.info(f"User {username} is already in group {manager_group}")
            return

        # Add user to the manager group
        client.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=manager_group,
        )

        # Invalidate user's session to force re-authentication with new permissions
        _invalidate_user_session(client, user_pool_id, username)

        logger.info(f"Added user {username} to group {manager_group}")

    except Exception as exc:
        # Log but don't fail the request if group assignment fails
        logger.error(f"Failed to add user {user_sub} to manager group: {exc}")


def _handle_list_cognito_users(event: Mapping[str, Any]) -> dict[str, Any]:
    """List Cognito users for manager selection.

    Returns a paginated list of users from the Cognito user pool with their
    sub (to use as manager_id), email, and other relevant attributes.

    Query parameters:
        - limit: Maximum number of users to return (default 50, max 60)
        - pagination_token: Token for fetching the next page of results
    """
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 60:
        raise ValidationError("limit must be between 1 and 60", field="limit")

    pagination_token = _query_param(event, "pagination_token")

    client = boto3.client("cognito-idp")
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    # Build request parameters
    list_params: dict[str, Any] = {
        "UserPoolId": user_pool_id,
        "Limit": limit,
    }
    if pagination_token:
        list_params["PaginationToken"] = pagination_token

    try:
        response = client.list_users(**list_params)
    except client.exceptions.InvalidParameterException as e:
        raise ValidationError(
            "Invalid pagination token", field="pagination_token"
        ) from e

    # Extract user data and fetch groups for each user
    users = []
    for user in response.get("Users", []):
        user_data = _serialize_cognito_user(user)
        if user_data:
            # Fetch groups for this user
            username = user.get("Username")
            if username:
                try:
                    groups_response = client.admin_list_groups_for_user(
                        UserPoolId=user_pool_id,
                        Username=username,
                    )
                    user_data["groups"] = [
                        g["GroupName"] for g in groups_response.get("Groups", [])
                    ]
                except Exception:
                    user_data["groups"] = []
            else:
                user_data["groups"] = []
            users.append(user_data)

    result: dict[str, Any] = {"items": users}

    # Include pagination token if there are more results
    next_token = response.get("PaginationToken")
    if next_token:
        result["pagination_token"] = next_token

    logger.info(f"Listed {len(users)} Cognito users")
    return json_response(200, result, event=event)


def _serialize_cognito_user(user: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Serialize a Cognito user for the API response.

    Args:
        user: The user object from Cognito ListUsers response.

    Returns:
        Serialized user data with sub, email, and status, or None if sub is missing.
    """
    from datetime import datetime, timezone

    attributes = {attr["Name"]: attr["Value"] for attr in user.get("Attributes", [])}

    # The sub attribute is required - it's the manager_id
    sub = attributes.get("sub")
    if not sub:
        return None

    # Parse last_auth_time from custom:last_auth_time attribute (epoch timestamp)
    # This is set by Cognito during authentication
    last_auth_time = None
    last_auth_time_str = attributes.get("custom:last_auth_time")
    if last_auth_time_str:
        try:
            # Convert epoch timestamp to ISO 8601 format
            epoch_time = int(last_auth_time_str)
            last_auth_time = datetime.fromtimestamp(
                epoch_time, tz=timezone.utc
            ).isoformat()
        except (ValueError, TypeError):
            pass

    return {
        "sub": sub,
        "email": attributes.get("email"),
        "email_verified": attributes.get("email_verified") == "true",
        "name": attributes.get("name"),
        "given_name": attributes.get("given_name"),
        "family_name": attributes.get("family_name"),
        "username": user.get("Username"),
        "status": user.get("UserStatus"),
        "enabled": user.get("Enabled", True),
        "created_at": user.get("UserCreateDate"),
        "updated_at": user.get("UserLastModifiedDate"),
        "last_auth_time": last_auth_time,
    }


def _handle_delete_cognito_user(
    event: Mapping[str, Any],
    username: str,
) -> dict[str, Any]:
    """Delete a Cognito user and transfer their organizations to a fallback manager.

    This endpoint:
    1. Gets the user's Cognito sub (subject) from their username
    2. Finds all organizations managed by this user
    3. Transfers them to a fallback manager (the admin calling the API)
    4. Deletes the user from Cognito

    Args:
        event: The Lambda event.
        username: The Cognito username of the user to delete.

    Returns:
        API Gateway response with deletion status and transferred orgs count.
    """
    client = boto3.client("cognito-idp")
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    # Get the admin's sub to use as fallback manager
    fallback_manager_id = _get_user_sub(event)
    if not fallback_manager_id:
        return json_response(401, {"error": "User identity not found"}, event=event)

    try:
        # Get the user to find their sub (subject)
        user_response = client.admin_get_user(
            UserPoolId=user_pool_id,
            Username=username,
        )

        # Extract the sub from user attributes
        user_sub = None
        for attr in user_response.get("UserAttributes", []):
            if attr["Name"] == "sub":
                user_sub = attr["Value"]
                break

        if not user_sub:
            return json_response(
                500,
                {"error": "User has no sub attribute"},
                event=event,
            )

        # Prevent admin from deleting themselves
        if user_sub == fallback_manager_id:
            return json_response(
                400,
                {"error": "Cannot delete yourself"},
                event=event,
            )

        # Transfer organizations to the fallback manager
        transferred_count = 0
        with Session(get_engine()) as session:
            org_repo = OrganizationRepository(session)
            orgs = org_repo.find_by_manager(user_sub, limit=1000)

            for org in orgs:
                org.manager_id = fallback_manager_id
                org_repo.update(org)
                transferred_count += 1

            session.commit()

        logger.info(
            f"Transferred {transferred_count} organizations from user {user_sub} "
            f"to fallback manager {fallback_manager_id}"
        )

        # Invalidate user's session before deletion
        _invalidate_user_session(client, user_pool_id, username)

        # Delete the user from Cognito
        client.admin_delete_user(
            UserPoolId=user_pool_id,
            Username=username,
        )

        logger.info(f"Deleted Cognito user: {username}")

        return json_response(
            200,
            {
                "status": "deleted",
                "username": username,
                "user_sub": user_sub,
                "transferred_organizations_count": transferred_count,
                "fallback_manager_id": fallback_manager_id,
            },
            event=event,
        )

    except client.exceptions.UserNotFoundException:
        raise NotFoundError("cognito_user", username)
    except Exception as exc:
        logger.exception(f"Failed to delete Cognito user: {username}")
        return json_response(
            500,
            {"error": "Failed to delete user", "detail": str(exc)},
            event=event,
        )


def _handle_organization_media(
    event: Mapping[str, Any],
    method: str,
    organization_id: Optional[str],
) -> dict[str, Any]:
    """Handle organization media uploads and deletions."""

    if not organization_id:
        raise ValidationError("organization id is required", field="id")

    org_uuid = _parse_uuid(organization_id)

    if method == "POST":
        return _handle_media_upload(event, org_uuid)
    if method == "DELETE":
        return _handle_media_delete(event, org_uuid)
    return json_response(405, {"error": "Method not allowed"}, event=event)


def _handle_media_upload(
    event: Mapping[str, Any],
    organization_id: UUID,
) -> dict[str, Any]:
    """Create a presigned URL for an organization media file."""

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

    bucket = _require_env("ORGANIZATION_MEDIA_BUCKET")
    object_key = _build_media_key(str(organization_id), str(file_name))
    base_url = _media_base_url()

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
            "media_url": f"{base_url}/{object_key}",
            "object_key": object_key,
            "expires_in": 900,
        },
        event=event,
    )


def _handle_media_delete(
    event: Mapping[str, Any],
    organization_id: UUID,
) -> dict[str, Any]:
    """Delete an organization media file from S3."""

    body = _parse_body(event)
    if isinstance(body, dict):
        object_key = body.get("object_key")
        media_url = body.get("media_url")
    else:
        object_key = None
        media_url = None

    if object_key:
        key = str(object_key)
    elif media_url:
        key = _extract_media_key(str(media_url))
    else:
        raise ValidationError(
            "media_url or object_key is required",
            field="media_url",
        )

    _validate_media_key(str(organization_id), key)
    bucket = _require_env("ORGANIZATION_MEDIA_BUCKET")

    client = boto3.client("s3")
    client.delete_object(Bucket=bucket, Key=key)

    return json_response(204, {}, event=event)


def _build_media_key(organization_id: str, file_name: str) -> str:
    """Build an S3 object key for a media file."""

    cleaned = _sanitize_media_filename(file_name)
    base, extension = os.path.splitext(cleaned)
    trimmed_base = base[:40].strip("_") or "image"
    suffix = extension.lower() if extension else ""
    unique = uuid4().hex
    return f"organizations/{organization_id}/{unique}-" f"{trimmed_base}{suffix}"


def _sanitize_media_filename(file_name: str) -> str:
    """Normalize user-supplied filenames."""

    trimmed = file_name.strip() or "image"
    return re.sub(r"[^A-Za-z0-9._-]", "_", trimmed)


def _media_base_url() -> str:
    """Return the base URL for organization media."""

    return _require_env("ORGANIZATION_MEDIA_BASE_URL").rstrip("/")


def _extract_media_key(media_url: str) -> str:
    """Extract an object key from a media URL."""

    base_url = _media_base_url()
    parsed_url = urlparse(media_url)
    base_parsed = urlparse(base_url)

    if parsed_url.netloc != base_parsed.netloc:
        raise ValidationError(
            "media_url is not hosted in the images bucket",
            field="media_url",
        )

    key = parsed_url.path.lstrip("/")
    if not key:
        raise ValidationError(
            "media_url must include an object key",
            field="media_url",
        )

    return key


def _validate_media_key(organization_id: str, object_key: str) -> None:
    """Ensure the object key matches the organization prefix."""

    prefix = f"organizations/{organization_id}/"
    if not object_key.startswith(prefix):
        raise ValidationError(
            "media_url does not match the organization",
            field="media_url",
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
    manager_id = _validate_manager_id(body.get("manager_id"), required=True)
    media_urls = _parse_media_urls(body.get("media_urls"))
    if media_urls:
        media_urls = _validate_media_urls(media_urls)

    return Organization(
        name=name,
        description=description,
        manager_id=manager_id,
        media_urls=media_urls,
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
    if "manager_id" in body:
        # manager_id is required, so if provided it must be a valid UUID
        entity.manager_id = _validate_manager_id(body["manager_id"], required=True)  # type: ignore[assignment]
    if "media_urls" in body:
        media_urls = _parse_media_urls(body["media_urls"])
        if media_urls:
            media_urls = _validate_media_urls(media_urls)
        entity.media_urls = media_urls
    return entity


def _serialize_organization(entity: Organization) -> dict[str, Any]:
    """Serialize an organization."""

    return {
        "id": str(entity.id),
        "name": entity.name,
        "description": entity.description,
        "manager_id": entity.manager_id,
        "media_urls": entity.media_urls or [],
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
MAX_MEDIA_URLS_COUNT = 20

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


def _validate_media_urls(urls: list[str]) -> list[str]:
    """Validate a list of media URLs.

    Args:
        urls: List of URLs to validate.

    Returns:
        The validated list of URLs.

    Raises:
        ValidationError: If validation fails.
    """
    if len(urls) > MAX_MEDIA_URLS_COUNT:
        raise ValidationError(
            f"media_urls cannot have more than {MAX_MEDIA_URLS_COUNT} items",
            field="media_urls",
        )

    validated = []
    for i, url in enumerate(urls):
        if url and url.strip():  # Skip empty or whitespace-only strings
            validated.append(_validate_url(url.strip(), f"media_urls[{i}]"))
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


def _validate_manager_id(manager_id: Any, required: bool = False) -> Optional[str]:
    """Validate and sanitize a Cognito user sub (manager_id).

    The manager_id should be a valid Cognito user sub, which is a UUID string.

    Args:
        manager_id: The manager_id value to validate.
        required: Whether the manager_id is required.

    Returns:
        The validated manager_id string, or None if empty/None and not required.

    Raises:
        ValidationError: If the manager_id format is invalid or missing when required.
    """
    if manager_id is None:
        if required:
            raise ValidationError("manager_id is required", field="manager_id")
        return None

    if not isinstance(manager_id, str):
        manager_id = str(manager_id)

    manager_id = manager_id.strip()

    if not manager_id:
        if required:
            raise ValidationError("manager_id is required", field="manager_id")
        return None

    # Cognito user sub is a UUID, validate format
    try:
        # Parse and re-format to ensure consistent UUID format
        parsed = UUID(manager_id)
        return str(parsed)
    except (ValueError, TypeError) as e:
        raise ValidationError(
            "manager_id must be a valid UUID (Cognito user sub)",
            field="manager_id",
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


def _parse_media_urls(value: Any) -> list[str]:
    """Parse media URLs from JSON."""

    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    raise ValidationError(
        "media_urls must be a list or comma-separated string",
        field="media_urls",
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
        manager_update_handler=_update_organization_for_manager,
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
