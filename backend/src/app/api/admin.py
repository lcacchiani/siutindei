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
import phonenumbers
import pycountry
from phonenumbers.phonenumberutil import NumberParseException
from psycopg.types.range import Range
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.aws_proxy import AwsProxyError
from app.services.aws_proxy import invoke as aws_proxy

from app.db.engine import get_engine
from app.db.models import Activity
from app.db.models import ActivityCategory
from app.db.models import ActivityPricing
from app.db.models import ActivitySchedule
from app.db.models import AuditLog
from app.db.models import GeographicArea
from app.db.models import Location
from app.db.models import Organization
from app.db.models import PricingType
from app.db.models import ScheduleType
from app.db.models import Ticket
from app.db.models import TicketStatus
from app.db.models import TicketType
from app.db.audit import AuditLogRepository, set_audit_context
from app.db.repositories import (
    ActivityCategoryRepository,
    ActivityPricingRepository,
    ActivityRepository,
    ActivityScheduleRepository,
    GeographicAreaRepository,
    LocationRepository,
    OrganizationRepository,
    TicketRepository,
)
from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response, parse_datetime, parse_int
from app.utils.logging import configure_logging, get_logger, set_request_context
from app.utils.responses import validate_content_type
from app.utils.translations import build_translation_map


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
        return _safe_handler(
            lambda: _handle_user_group(event, method, resource_id), event
        )
    if resource == "organizations" and sub_resource == "media":
        return _handle_organization_media(event, method, resource_id)
    if resource == "cognito-users" and method == "GET":
        return _safe_handler(lambda: _handle_list_cognito_users(event), event)
    if resource == "cognito-users" and method == "DELETE" and resource_id:
        return _safe_handler(
            lambda: _handle_delete_cognito_user(event, resource_id),
            event,
        )
    if resource == "tickets":
        return _handle_admin_tickets(event, method, resource_id)
    if resource == "audit-logs" and method == "GET":
        return _safe_handler(lambda: _handle_audit_logs(event, resource_id), event)

    # Geographic areas management (admin can list all or toggle active)
    if resource == "areas":
        if method == "GET":
            return _safe_handler(
                lambda: _handle_list_areas(event, active_only=False),
                event,
            )
        if method == "PATCH" and resource_id:
            return _safe_handler(
                lambda: _handle_toggle_area(event, resource_id),
                event,
            )

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
        # Set audit context for trigger-based audit logging
        _set_session_audit_context(session, event)

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


def _to_uuid(value: UUID | str) -> UUID:
    """Normalize a UUID from UUID or string input."""
    if isinstance(value, UUID):
        return value
    return _parse_uuid(value)


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


def _set_session_audit_context(session: Session, event: Mapping[str, Any]) -> None:
    """Set audit context on the database session for trigger-based logging.

    This sets PostgreSQL session variables that the audit trigger function
    reads to populate user_id and request_id fields in audit_log entries.

    Args:
        session: SQLAlchemy database session.
        event: Lambda event containing user and request context.
    """
    user_sub = _get_user_sub(event)
    request_id = event.get("requestContext", {}).get("requestId", "")
    set_audit_context(session, user_id=user_sub, request_id=request_id)


def _get_managed_organization_ids(event: Mapping[str, Any]) -> set[str]:
    """Get the IDs of organizations managed by the current user.

    Returns:
        Set of organization IDs (as strings) managed by the user.
    """
    user_sub = _get_user_sub(event)
    if not user_sub:
        return set()

    with Session(get_engine()) as session:
        # Read-only query, but set context for consistency
        _set_session_audit_context(session, event)
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
        /v1/user/organization-suggestion - Suggest a new organization/place
    """
    # Access request - any logged-in user can request
    if resource == "access-request":
        return _safe_handler(
            lambda: _handle_user_access_request(event, method),
            event,
        )

    # Organization suggestion - any logged-in user can suggest places
    if resource == "organization-suggestion":
        return _safe_handler(
            lambda: _handle_user_organization_suggestion(event, method),
            event,
        )

    # Geographic areas - any logged-in user can fetch the area tree
    if resource == "areas" and method == "GET":
        return _safe_handler(
            lambda: _handle_list_areas(event, active_only=True),
            event,
        )

    # Activity categories - any logged-in user can fetch the tree
    if resource == "activity-categories" and method == "GET":
        return _safe_handler(
            lambda: _handle_list_activity_categories(event),
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
    if "name_translations" in body:
        entity.name_translations = _validate_translations_map(
            body["name_translations"], "name_translations", MAX_NAME_LENGTH
        )
    if "description_translations" in body:
        entity.description_translations = _validate_translations_map(
            body["description_translations"],
            "description_translations",
            MAX_DESCRIPTION_LENGTH,
        )
    if "media_urls" in body:
        media_urls = _parse_media_urls(body["media_urls"])
        if media_urls:
            media_urls = _validate_media_urls(media_urls)
        entity.media_urls = media_urls
    _apply_organization_contact_fields(entity, body)
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
            _set_session_audit_context(session, event)
            org_repo = OrganizationRepository(session)
            ticket_repo = TicketRepository(session)

            # Get user's organizations
            user_orgs = org_repo.find_by_manager(user_sub)

            # Check for pending request
            pending_ticket = ticket_repo.find_pending_by_submitter(
                user_sub, TicketType.ACCESS_REQUEST
            )

            return json_response(
                200,
                {
                    "has_pending_request": pending_ticket is not None,
                    "pending_request": _serialize_ticket(pending_ticket)
                    if pending_ticket
                    else None,
                    "organizations_count": len(user_orgs),
                },
                event=event,
            )

    if method == "POST":
        # Submit a new manager request
        body = _parse_body(event)

        # Validate request fields first (before any DB or SNS operations)
        organization_name_validated = _validate_string_length(
            body.get("organization_name"),
            "organization_name",
            MAX_NAME_LENGTH,
            required=True,
        )
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
            _set_session_audit_context(session, event)
            ticket_repo = TicketRepository(session)

            # Check if user already has a pending request
            existing = ticket_repo.find_pending_by_submitter(
                user_sub, TicketType.ACCESS_REQUEST
            )
            if existing:
                return json_response(
                    409,
                    {
                        "error": "You already have a pending access request",
                        "request": _serialize_ticket(existing),
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

    Queries the tickets table for the highest existing R-prefix
    ticket number and increments it by 1.

    Args:
        session: SQLAlchemy database session for querying existing tickets.

    Returns:
        A new ticket ID like R00001, R00002, etc.
    """
    from sqlalchemy import text as sa_text

    result = session.execute(
        sa_text(
            "SELECT MAX(CAST(SUBSTRING(ticket_id FROM 2) AS BIGINT)) "
            "FROM tickets "
            "WHERE ticket_id LIKE 'R%'"
        )
    ).scalar()

    next_number = (result or 0) + 1
    return f"R{next_number:05d}"


def _serialize_ticket(
    ticket: Optional[Ticket],
) -> Optional[dict[str, Any]]:
    """Serialize a ticket for the API response.

    Returns a common shape with all fields. Consumers can check
    ticket_type to know which optional fields are relevant.
    """
    if ticket is None:
        return None
    return {
        "id": str(ticket.id),
        "ticket_id": ticket.ticket_id,
        "ticket_type": ticket.ticket_type.value,
        "organization_name": ticket.organization_name,
        "message": ticket.message,
        "status": ticket.status.value,
        "submitter_email": ticket.submitter_email,
        "submitter_id": ticket.submitter_id,
        "created_at": (ticket.created_at.isoformat() if ticket.created_at else None),
        "reviewed_at": (ticket.reviewed_at.isoformat() if ticket.reviewed_at else None),
        "reviewed_by": ticket.reviewed_by,
        "admin_notes": ticket.admin_notes,
        # Optional fields (depend on ticket_type)
        "description": ticket.description,
        "suggested_district": ticket.suggested_district,
        "suggested_address": ticket.suggested_address,
        "suggested_lat": (
            float(ticket.suggested_lat) if ticket.suggested_lat else None
        ),
        "suggested_lng": (
            float(ticket.suggested_lng) if ticket.suggested_lng else None
        ),
        "media_urls": ticket.media_urls or [],
        "created_organization_id": (
            str(ticket.created_organization_id)
            if ticket.created_organization_id
            else None
        ),
    }


# --- Admin tickets management ---


def _handle_admin_tickets(
    event: Mapping[str, Any],
    method: str,
    ticket_id_param: Optional[str],
) -> dict[str, Any]:
    """Handle admin ticket management.

    GET: List all tickets (optionally filtered by type and/or status)
    PUT /{id}: Approve or reject a ticket
    """
    try:
        if method == "GET":
            return _list_admin_tickets(event)
        if method == "PUT" and ticket_id_param:
            return _review_ticket(event, ticket_id_param)
        return json_response(405, {"error": "Method not allowed"}, event=event)
    except ValidationError as exc:
        logger.warning(f"Validation error: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except NotFoundError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except Exception as exc:
        logger.exception("Unexpected error in admin tickets handler")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


def _list_admin_tickets(event: Mapping[str, Any]) -> dict[str, Any]:
    """List all tickets for admin review."""
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 200:
        raise ValidationError("limit must be between 1 and 200", field="limit")

    # Parse status filter
    status_filter = _query_param(event, "status")
    status = None
    if status_filter:
        try:
            status = TicketStatus(status_filter)
        except ValueError:
            raise ValidationError(
                f"Invalid status: {status_filter}. "
                "Must be pending, approved, or rejected",
                field="status",
            )

    # Parse ticket_type filter
    type_filter = _query_param(event, "ticket_type")
    ticket_type = None
    if type_filter:
        try:
            ticket_type = TicketType(type_filter)
        except ValueError:
            raise ValidationError(
                f"Invalid ticket_type: {type_filter}. "
                "Must be access_request or organization_suggestion",
                field="ticket_type",
            )

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = TicketRepository(session)
        cursor = _parse_cursor(_query_param(event, "cursor"))
        rows = repo.find_all(
            ticket_type=ticket_type,
            status=status,
            limit=limit + 1,
            cursor=cursor,
        )
        has_more = len(rows) > limit
        trimmed = list(rows)[:limit]
        next_cursor = _encode_cursor(trimmed[-1].id) if has_more and trimmed else None

        pending_count = repo.count_pending(ticket_type=ticket_type)

        return json_response(
            200,
            {
                "items": [_serialize_ticket(row) for row in trimmed],
                "next_cursor": next_cursor,
                "pending_count": pending_count,
            },
            event=event,
        )


def _review_ticket(
    event: Mapping[str, Any],
    ticket_id_param: str,
) -> dict[str, Any]:
    """Approve or reject a ticket.

    Approval behaviour is determined by ticket_type. The request body
    may include organization_id, create_organization, and admin_notes.
    """
    from datetime import datetime, timezone

    body = _parse_body(event)
    action = body.get("action")
    admin_notes = body.get("admin_notes") or body.get("message", "")

    if action not in ("approve", "reject"):
        raise ValidationError(
            "action must be 'approve' or 'reject'",
            field="action",
        )

    reviewer_sub = _get_user_sub(event)
    if not reviewer_sub:
        return json_response(401, {"error": "User identity not found"}, event=event)

    organization_id = body.get("organization_id")
    create_organization = body.get("create_organization", False)

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = TicketRepository(session)
        ticket = repo.get_by_id(_parse_uuid(ticket_id_param))

        if ticket is None:
            raise NotFoundError("ticket", ticket_id_param)

        if ticket.status != TicketStatus.PENDING:
            return json_response(
                409,
                {"error": f"Ticket has already been {ticket.status.value}"},
                event=event,
            )

        organization = None

        # --- access_request approval logic ---
        if ticket.ticket_type == TicketType.ACCESS_REQUEST and action == "approve":
            if not organization_id and not create_organization:
                raise ValidationError(
                    "When approving an access request, you must either "
                    "provide organization_id or set create_organization to true",
                    field="organization_id",
                )
            if organization_id and create_organization:
                raise ValidationError(
                    "Cannot both select an existing organization and create a new one",
                    field="organization_id",
                )

            org_repo = OrganizationRepository(session)

            if organization_id:
                organization = org_repo.get_by_id(_parse_uuid(organization_id))
                if organization is None:
                    raise NotFoundError("organization", organization_id)
                organization.manager_id = ticket.submitter_id
                org_repo.update(organization)
                logger.info(
                    f"Assigned organization {organization_id} "
                    f"to user {ticket.submitter_id}"
                )
            elif create_organization:
                organization = Organization(
                    name=ticket.organization_name,
                    description=None,
                    manager_id=ticket.submitter_id,
                    media_urls=[],
                )
                org_repo.create(organization)
                logger.info(
                    f"Created organization '{ticket.organization_name}' "
                    f"for user {ticket.submitter_id}"
                )

            # Add the user to the 'manager' Cognito group
            _add_user_to_manager_group(ticket.submitter_id)

        # --- organization_suggestion approval logic ---
        if (
            ticket.ticket_type == TicketType.ORGANIZATION_SUGGESTION
            and action == "approve"
            and create_organization
        ):
            org_repo = OrganizationRepository(session)
            location_repo = LocationRepository(session)

            organization = Organization(
                name=ticket.organization_name,
                description=ticket.description,
                manager_id=reviewer_sub,  # Admin becomes temporary manager
                media_urls=ticket.media_urls or [],
            )
            org_repo.create(organization)

            if ticket.suggested_district:
                # Resolve area_id from the suggested district name
                geo_repo = GeographicAreaRepository(session)
                all_areas = geo_repo.get_all_flat(active_only=False)
                matched_area = next(
                    (
                        a
                        for a in all_areas
                        if a.level == "district" and a.name == ticket.suggested_district
                    ),
                    None,
                )
                if matched_area is None:
                    matched_area = next(
                        (a for a in all_areas if a.level == "district"),
                        None,
                    )

                if matched_area is not None:
                    location = Location(
                        org_id=organization.id,
                        area_id=matched_area.id,
                        address=ticket.suggested_address,
                        lat=ticket.suggested_lat,
                        lng=ticket.suggested_lng,
                    )
                    location_repo.create(location)

            ticket.created_organization_id = organization.id
            logger.info(
                f"Created organization '{ticket.organization_name}' "
                f"from suggestion {ticket.ticket_id}"
            )

        # Update the ticket status
        new_status = (
            TicketStatus.APPROVED if action == "approve" else TicketStatus.REJECTED
        )
        ticket.status = new_status
        ticket.reviewed_at = datetime.now(timezone.utc)
        ticket.reviewed_by = reviewer_sub
        ticket.admin_notes = admin_notes

        repo.update(ticket)
        session.commit()
        session.refresh(ticket)

        if organization:
            session.refresh(organization)

        logger.info(f"Ticket {ticket_id_param} {action}d by {reviewer_sub}")

        # Send notification email to the submitter
        _send_ticket_decision_email(ticket, action, admin_notes)

        response_data: dict[str, Any] = {
            "message": f"Ticket has been {action}d",
            "ticket": _serialize_ticket(ticket),
        }

        if organization:
            response_data["organization"] = _serialize_organization(organization)

        return json_response(200, response_data, event=event)


def _send_ticket_decision_email(
    ticket: Ticket,
    action: str,
    admin_notes: str,
) -> None:
    """Send email notification to submitter about their ticket decision."""
    sender_email = os.getenv("SES_SENDER_EMAIL")

    if not sender_email:
        logger.warning("Email notification skipped: SES_SENDER_EMAIL not configured")
        return

    if not ticket.submitter_email or ticket.submitter_email == "unknown":
        logger.warning(
            f"Email notification skipped: No valid email for ticket {ticket.ticket_id}"
        )
        return

    try:
        ses_client = boto3.client("ses")

        if ticket.ticket_type == TicketType.ACCESS_REQUEST:
            from app.templates import render_request_decision_email

            email_content = render_request_decision_email(
                ticket_id=ticket.ticket_id,
                organization_name=ticket.organization_name,
                reviewed_at=(
                    ticket.reviewed_at.isoformat() if ticket.reviewed_at else "Unknown"
                ),
                action=action,
                admin_message=admin_notes if admin_notes else None,
            )

            ses_client.send_email(
                Source=sender_email,
                Destination={"ToAddresses": [ticket.submitter_email]},
                Message={
                    "Subject": {
                        "Data": email_content.subject,
                        "Charset": "UTF-8",
                    },
                    "Body": {
                        "Text": {
                            "Data": email_content.body_text,
                            "Charset": "UTF-8",
                        },
                        "Html": {
                            "Data": email_content.body_html,
                            "Charset": "UTF-8",
                        },
                    },
                },
            )
        else:
            # Suggestion decision - inline email (same as before)
            if action == "approve":
                subject = f"Your place suggestion {ticket.ticket_id} has been approved!"
                body_text = (
                    f"Great news! Your suggestion for "
                    f"'{ticket.organization_name}' has been approved "
                    f"and added to our platform.\n\n"
                    f"Thank you for helping us grow our community!\n\n"
                )
                if admin_notes:
                    body_text += f"Note from admin: {admin_notes}\n"
            else:
                subject = f"Update on your place suggestion {ticket.ticket_id}"
                body_text = (
                    f"Thank you for suggesting "
                    f"'{ticket.organization_name}'.\n\n"
                    f"Unfortunately, we were unable to add this place "
                    f"to our platform at this time.\n\n"
                )
                if admin_notes:
                    body_text += f"Reason: {admin_notes}\n"
                body_text += (
                    "\nWe appreciate your contribution and encourage "
                    "you to submit other suggestions in the future!"
                )

            ses_client.send_email(
                Source=sender_email,
                Destination={"ToAddresses": [ticket.submitter_email]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Text": {"Data": body_text, "Charset": "UTF-8"},
                    },
                },
            )

        logger.info(
            f"Ticket decision email sent to {ticket.submitter_email} "
            f"for {ticket.ticket_id}"
        )
    except Exception as exc:
        # Don't fail the request if email fails
        logger.error(f"Failed to send ticket decision email: {exc}")


# --- Organization suggestion management (user routes) ---


def _handle_user_organization_suggestion(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle user organization suggestion operations.

    Any logged-in user can suggest new organizations/places for admin review.
    Unlike access requests, users don't become managers - they just inform
    about new places.

    GET: Check user's suggestion history
    POST: Submit a new organization suggestion
    """
    user_sub = _get_user_sub(event)
    user_email = _get_user_email(event)

    if not user_sub:
        return json_response(401, {"error": "User identity not found"}, event=event)

    if method == "GET":
        return _get_user_suggestions(event, user_sub)

    if method == "POST":
        return _submit_organization_suggestion(event, user_sub, user_email)

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _get_user_suggestions(
    event: Mapping[str, Any],
    user_sub: str,
) -> dict[str, Any]:
    """Get the current user's suggestion history."""
    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = TicketRepository(session)

        # Get user's suggestions
        suggestions = repo.find_by_submitter(
            user_sub, ticket_type=TicketType.ORGANIZATION_SUGGESTION, limit=50
        )

        # Check for pending suggestion
        pending = repo.find_pending_by_submitter(
            user_sub, TicketType.ORGANIZATION_SUGGESTION
        )

        return json_response(
            200,
            {
                "has_pending_suggestion": pending is not None,
                "suggestions": [_serialize_ticket(s) for s in suggestions],
            },
            event=event,
        )


def _submit_organization_suggestion(
    event: Mapping[str, Any],
    user_sub: str,
    user_email: Optional[str],
) -> dict[str, Any]:
    """Submit a new organization suggestion.

    Publishes to SNS for async processing, similar to manager requests.
    """
    body = _parse_body(event)

    # Validate required fields
    organization_name = _validate_string_length(
        body.get("organization_name"),
        "organization_name",
        MAX_NAME_LENGTH,
        required=True,
    )
    if organization_name is None:
        raise ValidationError(
            "organization_name is required", field="organization_name"
        )

    # Validate optional fields
    description = _validate_string_length(
        body.get("description"),
        "description",
        MAX_DESCRIPTION_LENGTH,
        required=False,
    )
    suggested_district = _validate_string_length(
        body.get("suggested_district"),
        "suggested_district",
        100,
        required=False,
    )
    suggested_address = _validate_string_length(
        body.get("suggested_address"),
        "suggested_address",
        MAX_ADDRESS_LENGTH,
        required=False,
    )
    additional_notes = _validate_string_length(
        body.get("additional_notes"),
        "additional_notes",
        MAX_DESCRIPTION_LENGTH,
        required=False,
    )

    # Validate coordinates if provided
    suggested_lat = body.get("suggested_lat")
    suggested_lng = body.get("suggested_lng")
    if suggested_lat is not None or suggested_lng is not None:
        _validate_coordinates(suggested_lat, suggested_lng)

    # Validate media URLs if provided
    media_urls = _parse_media_urls(body.get("media_urls"))
    if media_urls:
        media_urls = _validate_media_urls(media_urls)

    # Check for existing pending suggestion
    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = TicketRepository(session)

        existing = repo.find_pending_by_submitter(
            user_sub, TicketType.ORGANIZATION_SUGGESTION
        )
        if existing:
            return json_response(
                409,
                {
                    "error": "You already have a pending suggestion",
                    "suggestion": _serialize_ticket(existing),
                },
                event=event,
            )

        # Generate ticket ID
        ticket_id = _generate_suggestion_ticket_id(session)

    # Get SNS topic ARN (reuse the manager request topic or use a dedicated one)
    topic_arn = os.getenv("SUGGESTION_TOPIC_ARN") or os.getenv(
        "MANAGER_REQUEST_TOPIC_ARN"
    )
    if not topic_arn:
        logger.error("SUGGESTION_TOPIC_ARN not configured")
        return json_response(
            500,
            {"error": "Service configuration error. Please contact support."},
            event=event,
        )

    # Publish to SNS for async processing
    return _publish_suggestion_to_sns(
        event=event,
        topic_arn=topic_arn,
        ticket_id=ticket_id,
        user_sub=user_sub,
        user_email=user_email or "unknown",
        organization_name=organization_name,
        description=description,
        suggested_district=suggested_district,
        suggested_address=suggested_address,
        suggested_lat=suggested_lat,
        suggested_lng=suggested_lng,
        media_urls=media_urls,
        additional_notes=additional_notes,
    )


def _publish_suggestion_to_sns(
    event: Mapping[str, Any],
    topic_arn: str,
    ticket_id: str,
    user_sub: str,
    user_email: str,
    organization_name: str,
    description: Optional[str],
    suggested_district: Optional[str],
    suggested_address: Optional[str],
    suggested_lat: Optional[float],
    suggested_lng: Optional[float],
    media_urls: list[str],
    additional_notes: Optional[str],
) -> dict[str, Any]:
    """Publish organization suggestion to SNS for async processing."""
    sns_client = boto3.client("sns")

    try:
        sns_client.publish(
            TopicArn=topic_arn,
            Message=json.dumps(
                {
                    "event_type": "organization_suggestion.submitted",
                    "ticket_id": ticket_id,
                    "suggester_id": user_sub,
                    "suggester_email": user_email,
                    "organization_name": organization_name,
                    "description": description,
                    "suggested_district": suggested_district,
                    "suggested_address": suggested_address,
                    "suggested_lat": suggested_lat,
                    "suggested_lng": suggested_lng,
                    "media_urls": media_urls,
                    "additional_notes": additional_notes,
                }
            ),
            MessageAttributes={
                "event_type": {
                    "DataType": "String",
                    "StringValue": "organization_suggestion.submitted",
                },
            },
        )

        logger.info(f"Published organization suggestion to SNS: {ticket_id}")

        return json_response(
            202,
            {
                "message": "Your suggestion has been submitted and is being processed",
                "ticket_id": ticket_id,
            },
            event=event,
        )

    except Exception as exc:
        logger.exception(f"Failed to publish organization suggestion to SNS: {exc}")
        return json_response(
            500,
            {"error": "Failed to submit suggestion. Please try again."},
            event=event,
        )


def _generate_suggestion_ticket_id(session: Session) -> str:
    """Generate a unique progressive ticket ID for suggestions.

    Format: S + 5 digits (e.g., S00001, S00002)
    """
    from sqlalchemy import text as sa_text

    result = session.execute(
        sa_text(
            "SELECT MAX(CAST(SUBSTRING(ticket_id FROM 2) AS BIGINT)) "
            "FROM tickets "
            "WHERE ticket_id LIKE 'S%'"
        )
    ).scalar()

    next_number = (result or 0) + 1
    return f"S{next_number:05d}"


# --- Audit log management ---


# Fields to redact from audit log old_values/new_values for security
AUDIT_REDACTED_FIELDS: frozenset[str] = frozenset(
    [
        "password",
        "secret",
        "token",
        "api_key",
    ]
)

# Valid table names that can be queried via the audit logs endpoint
AUDITABLE_TABLES: frozenset[str] = frozenset(
    [
        "organizations",
        "locations",
        "activities",
        "activity_locations",
        "activity_pricing",
        "activity_schedule",
        "tickets",
    ]
)


def _handle_audit_logs(
    event: Mapping[str, Any],
    audit_id: Optional[str],
) -> dict[str, Any]:
    """Handle audit log queries.

    Query parameters:
        - table: Filter by table name (required if record_id is provided)
        - record_id: Filter by specific record ID
        - user_id: Filter by user who made the change
        - action: Filter by action type (INSERT, UPDATE, DELETE)
        - since: Filter by timestamp (ISO 8601 format)
        - limit: Maximum entries to return (default 50, max 200)
        - cursor: Pagination cursor

    If audit_id is provided, returns a single audit log entry.
    """
    # Single audit log entry by ID
    if audit_id:
        logger.info(f"Fetching audit log entry: {audit_id}")
        return _get_audit_log_by_id(event, audit_id)

    # List/filter audit logs
    logger.info("Listing audit logs with filters")
    return _list_audit_logs(event)


def _get_audit_log_by_id(
    event: Mapping[str, Any],
    audit_id: str,
) -> dict[str, Any]:
    """Get a single audit log entry by ID."""
    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = AuditLogRepository(session)

        try:
            entry = repo.get_by_id(_parse_uuid(audit_id))
        except ValidationError:
            raise NotFoundError("audit_log", audit_id)

        if entry is None:
            raise NotFoundError("audit_log", audit_id)

        return json_response(200, _serialize_audit_log(entry), event=event)


def _list_audit_logs(event: Mapping[str, Any]) -> dict[str, Any]:
    """List audit logs with optional filtering."""
    # Parse and validate query parameters
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 200:
        raise ValidationError("limit must be between 1 and 200", field="limit")

    table_name = _query_param(event, "table")
    record_id = _query_param(event, "record_id")
    user_id = _query_param(event, "user_id")
    action = _query_param(event, "action")
    since_str = _query_param(event, "since")

    # Validate table name if provided
    if table_name and table_name not in AUDITABLE_TABLES:
        raise ValidationError(
            f"Invalid table: {table_name}. Must be one of: {', '.join(sorted(AUDITABLE_TABLES))}",
            field="table",
        )

    # record_id requires table
    if record_id and not table_name:
        raise ValidationError(
            "table parameter is required when filtering by record_id",
            field="table",
        )

    # Validate action if provided
    valid_actions = {"INSERT", "UPDATE", "DELETE"}
    if action and action.upper() not in valid_actions:
        raise ValidationError(
            f"Invalid action: {action}. Must be one of: INSERT, UPDATE, DELETE",
            field="action",
        )

    # Parse since timestamp
    since = None
    if since_str:
        since = parse_datetime(since_str)
        if since is None:
            raise ValidationError(
                "Invalid since format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)",
                field="since",
            )

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = AuditLogRepository(session)
        cursor = _parse_cursor(_query_param(event, "cursor"))

        # Choose the appropriate query method based on filters
        if record_id and table_name:
            # Get history for a specific record
            rows = repo.get_record_history(
                table_name=table_name,
                record_id=record_id,
                limit=limit + 1,
            )
        elif user_id:
            # Get activity for a specific user
            rows = repo.get_user_activity(
                user_id=user_id,
                limit=limit + 1,
                since=since,
            )
        elif table_name:
            # Get activity for a specific table
            rows = repo.get_table_activity(
                table_name=table_name,
                limit=limit + 1,
                since=since,
                action=action.upper() if action else None,
            )
        else:
            # Get recent activity across all tables
            rows = repo.get_recent_activity(
                limit=limit + 1,
                since=since,
                cursor=cursor,
            )

        has_more = len(rows) > limit
        trimmed = list(rows)[:limit]
        next_cursor = _encode_cursor(trimmed[-1].id) if has_more and trimmed else None

        logger.info(
            f"Audit logs query returned {len(trimmed)} entries (has_more={has_more})",
            extra={
                "table": table_name,
                "action": action,
                "since": since_str,
                "result_count": len(trimmed),
            },
        )

        return json_response(
            200,
            {
                "items": [_serialize_audit_log(row) for row in trimmed],
                "next_cursor": next_cursor,
            },
            event=event,
        )


def _serialize_audit_log(
    entry: AuditLog,
    redact_sensitive: bool = True,
) -> dict[str, Any]:
    """Serialize an audit log entry for the API response.

    Args:
        entry: The AuditLog model instance.
        redact_sensitive: Whether to redact sensitive fields from values.

    Returns:
        Serialized audit log entry.
    """
    result: dict[str, Any] = {
        "id": str(entry.id),
        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
        "table_name": entry.table_name,
        "record_id": entry.record_id,
        "action": entry.action,
        "user_id": entry.user_id,
        "request_id": entry.request_id,
        "changed_fields": entry.changed_fields,
        "source": entry.source,
    }

    # Include old/new values with optional redaction
    if entry.old_values:
        result["old_values"] = (
            _redact_sensitive_fields(entry.old_values)
            if redact_sensitive
            else entry.old_values
        )
    else:
        result["old_values"] = None

    if entry.new_values:
        result["new_values"] = (
            _redact_sensitive_fields(entry.new_values)
            if redact_sensitive
            else entry.new_values
        )
    else:
        result["new_values"] = None

    # Include client context fields
    result["ip_address"] = entry.ip_address
    result["user_agent"] = entry.user_agent

    return result


def _redact_sensitive_fields(values: dict[str, Any]) -> dict[str, Any]:
    """Redact sensitive fields from a dictionary.

    Args:
        values: Dictionary of field values.

    Returns:
        Dictionary with sensitive fields redacted.
    """
    result: dict[str, Any] = {}
    for key, value in values.items():
        key_lower = key.lower()
        # Check if any sensitive term is in the field name
        if any(term in key_lower for term in AUDIT_REDACTED_FIELDS):
            result[key] = "[REDACTED]"
        else:
            result[key] = value
    return result


# --- Geographic Areas ---


def _handle_list_areas(
    event: Mapping[str, Any],
    active_only: bool = True,
) -> dict[str, Any]:
    """Return the geographic area tree.

    When active_only=True (user route), only active countries and their
    children are returned.  When active_only=False (admin route), all
    countries are returned so admins can toggle activation.
    """
    with Session(get_engine()) as session:
        repo = GeographicAreaRepository(session)
        areas = repo.get_all_flat(active_only=active_only)

    # Build a nested tree from the flat list
    areas_by_id: dict[str, dict[str, Any]] = {}
    roots: list[dict[str, Any]] = []

    for area in areas:
        node = _serialize_area(area)
        node["children"] = []
        areas_by_id[str(area.id)] = node

    for area in areas:
        node = areas_by_id[str(area.id)]
        parent_key = str(area.parent_id) if area.parent_id else None
        if parent_key and parent_key in areas_by_id:
            areas_by_id[parent_key]["children"].append(node)
        elif parent_key is None:
            roots.append(node)

    return json_response(200, {"items": roots}, event=event)


def _handle_toggle_area(
    event: Mapping[str, Any],
    area_id_str: str,
) -> dict[str, Any]:
    """Toggle the active flag on a geographic area (admin only)."""
    area_uuid = _parse_uuid(area_id_str)

    body = _parse_body(event)
    active = body.get("active")
    if active is None or not isinstance(active, bool):
        raise ValidationError("active (boolean) is required", field="active")

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = GeographicAreaRepository(session)
        area = repo.toggle_active(area_uuid, active)
        if area is None:
            raise NotFoundError("geographic_area", area_id_str)
        session.commit()
        session.refresh(area)
        return json_response(200, _serialize_area(area), event=event)


def _serialize_area(area: GeographicArea) -> dict[str, Any]:
    """Serialize a geographic area for the API response."""
    return {
        "id": str(area.id),
        "parent_id": str(area.parent_id) if area.parent_id else None,
        "name": area.name,
        "name_translations": build_translation_map(area.name, area.name_translations),
        "level": area.level,
        "code": area.code,
        "active": area.active,
        "display_order": area.display_order,
    }


# --- Activity Categories ---


def _handle_list_activity_categories(
    event: Mapping[str, Any],
) -> dict[str, Any]:
    """Return the activity category tree."""
    with Session(get_engine()) as session:
        repo = ActivityCategoryRepository(session)
        categories = repo.get_all_flat()

    tree = _build_activity_category_tree(categories)
    return json_response(200, {"items": tree}, event=event)


def _build_activity_category_tree(
    categories: Sequence[ActivityCategory],
) -> list[dict[str, Any]]:
    """Build a nested tree from a flat category list."""
    categories_by_id: dict[str, dict[str, Any]] = {}
    roots: list[dict[str, Any]] = []

    for category in categories:
        node = _serialize_activity_category(category)
        node["children"] = []
        categories_by_id[str(category.id)] = node

    for category in categories:
        node = categories_by_id[str(category.id)]
        parent_key = str(category.parent_id) if category.parent_id else None
        if parent_key and parent_key in categories_by_id:
            categories_by_id[parent_key]["children"].append(node)
        else:
            roots.append(node)

    _sort_activity_category_tree(roots)
    return roots


def _sort_activity_category_tree(nodes: list[dict[str, Any]]) -> None:
    """Sort category nodes by display_order then name."""
    nodes.sort(key=lambda n: (n["display_order"], n["name"].lower(), n["id"]))
    for node in nodes:
        _sort_activity_category_tree(node["children"])


# --- Cognito proxy helper ---


def _cognito(action: str, **params: Any) -> dict[str, Any]:
    """Call a Cognito IDP action via the AWS API proxy Lambda."""
    return aws_proxy("cognito-idp", action, params)


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
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    if method == "POST":
        _cognito(
            "admin_add_user_to_group",
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        _invalidate_user_session(user_pool_id, username)
        logger.info(f"Added user {username} to group {group_name}")
        return json_response(200, {"status": "added", "group": group_name}, event=event)

    if method == "DELETE":
        _cognito(
            "admin_remove_user_from_group",
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        _invalidate_user_session(user_pool_id, username)
        logger.info(f"Removed user {username} from group {group_name}")
        return json_response(
            200, {"status": "removed", "group": group_name}, event=event
        )

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _invalidate_user_session(user_pool_id: str, username: str) -> None:
    """Invalidate a user's session by signing them out globally."""
    try:
        _cognito(
            "admin_user_global_sign_out",
            UserPoolId=user_pool_id,
            Username=username,
        )
        logger.info(f"Invalidated session for user: {username}")
    except Exception as exc:
        logger.warning(f"Failed to invalidate session for user {username}: {exc}")


def _add_user_to_manager_group(user_sub: str) -> None:
    """Add a user to the 'manager' Cognito group."""
    try:
        user_pool_id = _require_env("COGNITO_USER_POOL_ID")
        manager_group = os.getenv("MANAGER_GROUP", "manager")

        response = _cognito(
            "list_users",
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

        groups_response = _cognito(
            "admin_list_groups_for_user",
            UserPoolId=user_pool_id,
            Username=username,
        )
        existing_groups = [g["GroupName"] for g in groups_response.get("Groups", [])]

        if manager_group in existing_groups:
            logger.info(f"User {username} is already in group {manager_group}")
            return

        _cognito(
            "admin_add_user_to_group",
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=manager_group,
        )
        _invalidate_user_session(user_pool_id, username)
        logger.info(f"Added user {username} to group {manager_group}")

    except Exception as exc:
        logger.error(f"Failed to add user {user_sub} to manager group: {exc}")


def _handle_list_cognito_users(event: Mapping[str, Any]) -> dict[str, Any]:
    """List Cognito users for manager selection."""
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 60:
        raise ValidationError("limit must be between 1 and 60", field="limit")

    pagination_token = _query_param(event, "pagination_token")
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    params: dict[str, Any] = {"UserPoolId": user_pool_id, "Limit": limit}
    if pagination_token:
        params["PaginationToken"] = pagination_token

    try:
        response = _cognito("list_users", **params)
    except AwsProxyError as exc:
        logger.warning(f"Cognito list_users error: {exc.code}: {exc.message}")
        if pagination_token and exc.code == "InvalidParameterException":
            raise ValidationError(
                "Invalid pagination token", field="pagination_token"
            ) from exc
        raise ValidationError(f"Cognito error: {exc.message}") from exc

    users = []
    for user in response.get("Users", []):
        user_data = _serialize_cognito_user(user)
        if user_data:
            username = user.get("Username")
            if username:
                try:
                    gr = _cognito(
                        "admin_list_groups_for_user",
                        UserPoolId=user_pool_id,
                        Username=username,
                    )
                    user_data["groups"] = [g["GroupName"] for g in gr.get("Groups", [])]
                except Exception:
                    user_data["groups"] = []
            else:
                user_data["groups"] = []
            users.append(user_data)

    result: dict[str, Any] = {"items": users}
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
    """Delete a Cognito user and transfer their organizations."""
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    fallback_manager_id = _get_user_sub(event)
    if not fallback_manager_id:
        return json_response(401, {"error": "User identity not found"}, event=event)

    try:
        user_response = _cognito(
            "admin_get_user", UserPoolId=user_pool_id, Username=username
        )
    except AwsProxyError as exc:
        if exc.code == "UserNotFoundException":
            raise NotFoundError("cognito_user", username)
        raise

    user_sub = None
    for attr in user_response.get("UserAttributes", []):
        if attr["Name"] == "sub":
            user_sub = attr["Value"]
            break

    if not user_sub:
        return json_response(500, {"error": "User has no sub attribute"}, event=event)
    if user_sub == fallback_manager_id:
        return json_response(400, {"error": "Cannot delete yourself"}, event=event)

    # Transfer organisations (DB, stays in VPC)
    transferred_count = 0
    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        org_repo = OrganizationRepository(session)
        orgs = org_repo.find_by_manager(user_sub, limit=1000)
        for org in orgs:
            org.manager_id = fallback_manager_id
            org_repo.update(org)
            transferred_count += 1
        session.commit()

    logger.info(
        f"Transferred {transferred_count} orgs from {user_sub} to {fallback_manager_id}"
    )

    _invalidate_user_session(user_pool_id, username)
    _cognito("admin_delete_user", UserPoolId=user_pool_id, Username=username)
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
    return f"organizations/{organization_id}/{unique}-{trimmed_base}{suffix}"


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


def _parse_organization_contact_fields(body: dict[str, Any]) -> dict[str, Any]:
    """Parse organization contact fields."""
    phone_country_code, phone_number = _validate_phone_fields(
        body.get("phone_country_code"),
        body.get("phone_number"),
    )
    return {
        "phone_country_code": phone_country_code,
        "phone_number": phone_number,
        "email": _validate_email(body.get("email")),
        "whatsapp": _validate_social_value(body.get("whatsapp"), "whatsapp"),
        "facebook": _validate_social_value(body.get("facebook"), "facebook"),
        "instagram": _validate_social_value(body.get("instagram"), "instagram"),
        "tiktok": _validate_social_value(body.get("tiktok"), "tiktok"),
        "twitter": _validate_social_value(body.get("twitter"), "twitter"),
        "xiaohongshu": _validate_social_value(
            body.get("xiaohongshu"),
            "xiaohongshu",
        ),
        "wechat": _validate_social_value(body.get("wechat"), "wechat"),
    }


def _apply_organization_contact_fields(
    entity: Organization,
    body: dict[str, Any],
) -> None:
    """Apply organization contact updates."""
    if "phone_country_code" in body or "phone_number" in body:
        country_code = body.get("phone_country_code", entity.phone_country_code)
        number = body.get("phone_number", entity.phone_number)
        country_code, number = _validate_phone_fields(country_code, number)
        entity.phone_country_code = country_code
        entity.phone_number = number
    if "email" in body:
        entity.email = _validate_email(body["email"])
    for field in SOCIAL_FIELDS:
        if field in body:
            setattr(
                entity,
                field,
                _validate_social_value(body[field], field),
            )


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
    name_translations = _validate_translations_map(
        body.get("name_translations"), "name_translations", MAX_NAME_LENGTH
    )
    description_translations = _validate_translations_map(
        body.get("description_translations"),
        "description_translations",
        MAX_DESCRIPTION_LENGTH,
    )
    manager_id = _validate_manager_id(body.get("manager_id"), required=True)
    media_urls = _parse_media_urls(body.get("media_urls"))
    if media_urls:
        media_urls = _validate_media_urls(media_urls)
    contact_fields = _parse_organization_contact_fields(body)

    return Organization(
        name=name,
        description=description,
        name_translations=name_translations,
        description_translations=description_translations,
        manager_id=manager_id,
        media_urls=media_urls,
        **contact_fields,
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
    if "name_translations" in body:
        entity.name_translations = _validate_translations_map(
            body["name_translations"], "name_translations", MAX_NAME_LENGTH
        )
    if "description_translations" in body:
        entity.description_translations = _validate_translations_map(
            body["description_translations"],
            "description_translations",
            MAX_DESCRIPTION_LENGTH,
        )
    if "manager_id" in body:
        # manager_id is required, so if provided it must be a valid UUID
        entity.manager_id = _validate_manager_id(body["manager_id"], required=True)  # type: ignore[assignment]
    if "media_urls" in body:
        media_urls = _parse_media_urls(body["media_urls"])
        if media_urls:
            media_urls = _validate_media_urls(media_urls)
        entity.media_urls = media_urls
    _apply_organization_contact_fields(entity, body)
    return entity


def _serialize_organization(entity: Organization) -> dict[str, Any]:
    """Serialize an organization."""

    return {
        "id": str(entity.id),
        "name": entity.name,
        "description": entity.description,
        "name_translations": build_translation_map(
            entity.name, entity.name_translations
        ),
        "description_translations": build_translation_map(
            entity.description, entity.description_translations
        ),
        "manager_id": entity.manager_id,
        "phone_country_code": entity.phone_country_code,
        "phone_number": entity.phone_number,
        "email": entity.email,
        "whatsapp": entity.whatsapp,
        "facebook": entity.facebook,
        "instagram": entity.instagram,
        "tiktok": entity.tiktok,
        "twitter": entity.twitter,
        "xiaohongshu": entity.xiaohongshu,
        "wechat": entity.wechat,
        "media_urls": entity.media_urls or [],
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }


def _create_location(repo: LocationRepository, body: dict[str, Any]) -> Location:
    """Create a location."""

    org_id = body.get("org_id")
    if not org_id:
        raise ValidationError("org_id is required", field="org_id")

    area_id_raw = body.get("area_id")
    if not area_id_raw:
        raise ValidationError("area_id is required", field="area_id")
    area_uuid = _parse_uuid(area_id_raw)

    # Validate area_id exists
    geo_repo = GeographicAreaRepository(repo._session)
    if geo_repo.get_by_id(area_uuid) is None:
        raise ValidationError("area_id not found", field="area_id")

    address = _validate_string_length(
        body.get("address"), "address", MAX_ADDRESS_LENGTH
    )

    lat = body.get("lat")
    lng = body.get("lng")
    _validate_coordinates(lat, lng)

    return Location(
        org_id=_parse_uuid(org_id),
        area_id=area_uuid,
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

    if "area_id" in body:
        area_uuid = _parse_uuid(body["area_id"])
        geo_repo = GeographicAreaRepository(repo._session)
        if geo_repo.get_by_id(area_uuid) is None:
            raise ValidationError("area_id not found", field="area_id")
        entity.area_id = area_uuid  # type: ignore[assignment]

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
        "area_id": str(entity.area_id),
        "address": entity.address,
        "lat": entity.lat,
        "lng": entity.lng,
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }


def _serialize_activity_category(
    entity: ActivityCategory,
) -> dict[str, Any]:
    """Serialize an activity category."""
    return {
        "id": str(entity.id),
        "parent_id": str(entity.parent_id) if entity.parent_id else None,
        "name": entity.name,
        "name_translations": build_translation_map(
            entity.name, entity.name_translations
        ),
        "display_order": entity.display_order,
    }


def _parse_display_order(value: Any) -> int:
    """Parse and validate display_order."""
    if value is None:
        return 0
    try:
        parsed = int(value)
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            "display_order must be a valid integer",
            field="display_order",
        ) from exc
    if parsed < 0:
        raise ValidationError(
            "display_order must be at least 0",
            field="display_order",
        )
    return parsed


def _validate_category_parent(
    repo: ActivityCategoryRepository,
    category_id: Optional[UUID | str],
    parent_id: Optional[UUID],
) -> None:
    """Validate that a parent exists and does not create cycles."""
    category_uuid = _to_uuid(category_id) if category_id is not None else None
    if parent_id is None:
        return
    if category_uuid is not None and parent_id == category_uuid:
        raise ValidationError(
            "parent_id cannot reference the same category",
            field="parent_id",
        )

    if repo.get_by_id(parent_id) is None:
        raise ValidationError("parent_id not found", field="parent_id")

    if category_uuid is None:
        return

    categories = repo.get_all_flat()
    children_by_parent: dict[str, list[str]] = {}
    for category in categories:
        if category.parent_id is None:
            continue
        pid = str(category.parent_id)
        children_by_parent.setdefault(pid, []).append(str(category.id))

    stack = [str(category_uuid)]
    descendants: set[str] = set()
    while stack:
        current = stack.pop()
        for child_id in children_by_parent.get(current, []):
            if child_id in descendants:
                continue
            descendants.add(child_id)
            stack.append(child_id)

    if str(parent_id) in descendants:
        raise ValidationError(
            "parent_id cannot be a descendant category",
            field="parent_id",
        )


def _create_activity_category(
    repo: ActivityCategoryRepository,
    body: dict[str, Any],
) -> ActivityCategory:
    """Create an activity category."""
    name = _validate_string_length(
        body.get("name"),
        "name",
        MAX_NAME_LENGTH,
        required=True,
    )
    name_translations = _validate_translations_map(
        body.get("name_translations"), "name_translations", MAX_NAME_LENGTH
    )
    parent_id_raw = body.get("parent_id")
    parent_id = _parse_uuid(parent_id_raw) if parent_id_raw else None
    _validate_category_parent(repo, None, parent_id)
    display_order = _parse_display_order(body.get("display_order"))

    return ActivityCategory(
        name=name,
        name_translations=name_translations,
        parent_id=parent_id,
        display_order=display_order,
    )


def _update_activity_category(
    repo: ActivityCategoryRepository,
    entity: ActivityCategory,
    body: dict[str, Any],
) -> ActivityCategory:
    """Update an activity category."""
    if "name" in body:
        name = _validate_string_length(
            body["name"], "name", MAX_NAME_LENGTH, required=True
        )
        entity.name = name  # type: ignore[assignment]
    if "name_translations" in body:
        entity.name_translations = _validate_translations_map(
            body["name_translations"], "name_translations", MAX_NAME_LENGTH
        )

    if "parent_id" in body:
        parent_id_raw = body["parent_id"]
        parent_id = _parse_uuid(parent_id_raw) if parent_id_raw else None
        _validate_category_parent(repo, entity.id, parent_id)
        entity.parent_id = parent_id  # type: ignore[assignment]

    if "display_order" in body:
        entity.display_order = _parse_display_order(body["display_order"])

    return entity


def _create_activity(repo: ActivityRepository, body: dict[str, Any]) -> Activity:
    """Create an activity."""

    org_id = body.get("org_id")
    if not org_id:
        raise ValidationError("org_id is required", field="org_id")

    category_id = body.get("category_id")
    if not category_id:
        raise ValidationError("category_id is required", field="category_id")

    name = _validate_string_length(
        body.get("name"), "name", MAX_NAME_LENGTH, required=True
    )
    description = _validate_string_length(
        body.get("description"), "description", MAX_DESCRIPTION_LENGTH
    )
    name_translations = _validate_translations_map(
        body.get("name_translations"), "name_translations", MAX_NAME_LENGTH
    )
    description_translations = _validate_translations_map(
        body.get("description_translations"),
        "description_translations",
        MAX_DESCRIPTION_LENGTH,
    )

    age_min = body.get("age_min")
    age_max = body.get("age_max")
    if age_min is None or age_max is None:
        raise ValidationError("age_min and age_max are required")

    _validate_age_range(age_min, age_max)
    age_range = Range(int(age_min), int(age_max), bounds="[]")

    category_uuid = _parse_uuid(category_id)
    category_repo = ActivityCategoryRepository(repo.session)
    if category_repo.get_by_id(category_uuid) is None:
        raise ValidationError("category_id not found", field="category_id")

    return Activity(
        org_id=_parse_uuid(org_id),
        category_id=category_uuid,
        name=name,
        description=description,
        name_translations=name_translations,
        description_translations=description_translations,
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
    if "name_translations" in body:
        entity.name_translations = _validate_translations_map(
            body["name_translations"], "name_translations", MAX_NAME_LENGTH
        )
    if "description_translations" in body:
        entity.description_translations = _validate_translations_map(
            body["description_translations"],
            "description_translations",
            MAX_DESCRIPTION_LENGTH,
        )
    if "category_id" in body:
        category_id = body["category_id"]
        if not category_id:
            raise ValidationError("category_id is required", field="category_id")
        category_uuid = _parse_uuid(category_id)
        category_repo = ActivityCategoryRepository(repo.session)
        if category_repo.get_by_id(category_uuid) is None:
            raise ValidationError("category_id not found", field="category_id")
        entity.category_id = category_uuid  # type: ignore[assignment]
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
        "category_id": str(entity.category_id),
        "name": entity.name,
        "description": entity.description,
        "name_translations": build_translation_map(
            entity.name, entity.name_translations
        ),
        "description_translations": build_translation_map(
            entity.description, entity.description_translations
        ),
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
MAX_URL_LENGTH = 2048
MAX_EMAIL_LENGTH = 320
MAX_PHONE_COUNTRY_CODE_LENGTH = 2
MAX_PHONE_NUMBER_LENGTH = 20
MAX_LANGUAGE_CODE_LENGTH = 10
MAX_LANGUAGES_COUNT = 20
MAX_MEDIA_URLS_COUNT = 20
MAX_SOCIAL_VALUE_LENGTH = 2048
MAX_SOCIAL_HANDLE_LENGTH = 64


# Valid ISO 4217 currency codes.
def _load_valid_currencies() -> frozenset[str]:
    codes: set[str] = set()
    for currency in pycountry.currencies:
        code = getattr(currency, "alpha_3", None)
        if code:
            codes.add(code.upper())
    return frozenset(codes)


VALID_CURRENCIES = _load_valid_currencies()

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

SOCIAL_FIELDS = (
    "whatsapp",
    "facebook",
    "instagram",
    "tiktok",
    "twitter",
    "xiaohongshu",
    "wechat",
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SOCIAL_HANDLE_RE = re.compile(r"^@?[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


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


def _looks_like_url(value: str) -> bool:
    """Return True when the value looks like a URL."""
    lower = value.lower()
    if lower.startswith("http://") or lower.startswith("https://"):
        return True
    if lower.startswith("www."):
        return True
    return "/" in value


def _normalize_social_url(value: str, field_name: str) -> str:
    """Normalize social URL values to include scheme."""
    normalized = value.strip()
    if not normalized.lower().startswith(("http://", "https://")):
        normalized = f"https://{normalized}"
    return _validate_url(normalized, field_name)


def _validate_social_value(value: Any, field_name: str) -> Optional[str]:
    """Validate a social handle or URL."""
    raw = _validate_string_length(value, field_name, MAX_SOCIAL_VALUE_LENGTH)
    if raw is None:
        return None
    if _looks_like_url(raw):
        return _normalize_social_url(raw, field_name)
    if len(raw) > MAX_SOCIAL_HANDLE_LENGTH:
        message = (
            f"{field_name} handle must be at most {MAX_SOCIAL_HANDLE_LENGTH} characters"
        )
        raise ValidationError(
            message,
            field=field_name,
        )
    if not SOCIAL_HANDLE_RE.match(raw):
        raise ValidationError(
            f"{field_name} must be a valid handle or URL",
            field=field_name,
        )
    return raw


def _validate_email(value: Any) -> Optional[str]:
    """Validate an email address."""
    email = _validate_string_length(value, "email", MAX_EMAIL_LENGTH)
    if email is None:
        return None
    if not EMAIL_RE.match(email):
        raise ValidationError(
            "email must be a valid email address",
            field="email",
        )
    return email


def _validate_phone_country_code(value: Any) -> Optional[str]:
    """Validate the phone country code (ISO 3166-1 alpha-2)."""
    code = _validate_string_length(
        value,
        "phone_country_code",
        MAX_PHONE_COUNTRY_CODE_LENGTH,
    )
    if code is None:
        return None
    code = code.upper()
    if code not in phonenumbers.SUPPORTED_REGIONS:
        raise ValidationError(
            "phone_country_code must be a valid ISO country code",
            field="phone_country_code",
        )
    return code


def _normalize_phone_number(value: Any) -> Optional[str]:
    """Normalize a phone number to digits only."""
    raw = _validate_string_length(
        value,
        "phone_number",
        MAX_PHONE_NUMBER_LENGTH,
    )
    if raw is None:
        return None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        raise ValidationError(
            "phone_number must contain digits",
            field="phone_number",
        )
    return digits


def _validate_phone_fields(
    phone_country_code: Any,
    phone_number: Any,
) -> tuple[Optional[str], Optional[str]]:
    """Validate phone fields together."""
    country_code = _validate_phone_country_code(phone_country_code)
    number = _normalize_phone_number(phone_number)

    if country_code is None and number is None:
        return None, None
    if country_code is None:
        raise ValidationError(
            "phone_country_code is required when phone_number is set",
            field="phone_country_code",
        )
    if number is None:
        raise ValidationError(
            "phone_number is required when phone_country_code is set",
            field="phone_number",
        )

    try:
        parsed = phonenumbers.parse(number, country_code)
    except NumberParseException as exc:
        raise ValidationError(
            "phone_number is not valid for phone_country_code",
            field="phone_number",
        ) from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValidationError(
            "phone_number is not valid for phone_country_code",
            field="phone_number",
        )

    return country_code, number


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


def _validate_translations_map(
    value: Any,
    field_name: str,
    max_length: int,
) -> dict[str, str]:
    """Validate a language translation map."""
    if value is None:
        return {}

    if not isinstance(value, dict):
        raise ValidationError(f"{field_name} must be an object", field=field_name)

    if len(value) > MAX_LANGUAGES_COUNT:
        raise ValidationError(
            f"{field_name} cannot have more than {MAX_LANGUAGES_COUNT} items",
            field=field_name,
        )

    cleaned: dict[str, str] = {}
    for key, raw in value.items():
        code = _validate_language_code(str(key), f"{field_name}.{key}")
        if code == "en":
            continue
        text = _validate_string_length(raw, f"{field_name}.{code}", max_length)
        if text is None:
            continue
        cleaned[code] = text
    return cleaned


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
    "activity-categories": ResourceConfig(
        name="activity-categories",
        model=ActivityCategory,
        repository_class=ActivityCategoryRepository,
        serializer=_serialize_activity_category,
        create_handler=_create_activity_category,
        update_handler=_update_activity_category,
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
