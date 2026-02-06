"""Cognito user management API handlers.

This module handles Cognito-specific admin operations that require access
to the Cognito API.  It is designed to run in a Lambda function OUTSIDE the
VPC so that it can reach the Cognito public API endpoints directly.

Operations that also require database access (e.g. deleting a user and
transferring their organizations) use Lambda-to-Lambda invocation to call
the in-VPC admin Lambda for the database portion.

Routes handled:
    GET    /v1/admin/cognito-users              - List Cognito users
    DELETE /v1/admin/cognito-users/{username}    - Delete a user
    POST   /v1/admin/users/{username}/groups     - Add user to group
    DELETE /v1/admin/users/{username}/groups     - Remove user from group
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Tuple

import boto3

from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response, parse_int
from app.utils.logging import configure_logging, get_logger, set_request_context
from app.utils.responses import validate_content_type

configure_logging()
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Route Cognito admin requests."""

    request_id = event.get("requestContext", {}).get("requestId", "")
    set_request_context(req_id=request_id)

    method = event.get("httpMethod", "")
    path = event.get("path", "")
    _base, resource, resource_id, sub_resource = _parse_path(path)

    # Validate Content-Type for requests with bodies
    try:
        validate_content_type(event)
    except ValidationError as exc:
        logger.warning(f"Content-Type validation failed: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)

    logger.info(
        f"Cognito admin request: {method} {path}",
        extra={"resource": resource, "resource_id": resource_id},
    )

    # Authorization: all callers must be in the admin group.
    # The API Gateway authorizer already enforces this, but we double-check.
    if not _is_admin(event):
        logger.warning("Unauthorized Cognito admin access attempt")
        return json_response(403, {"error": "Forbidden"}, event=event)

    # --- Routing ---
    if resource == "cognito-users" and method == "GET" and not resource_id:
        return _safe(lambda: _handle_list_cognito_users(event), event)

    if resource == "cognito-users" and method == "DELETE" and resource_id:
        return _safe(lambda: _handle_delete_cognito_user(event, resource_id), event)

    if resource == "users" and sub_resource == "groups":
        return _safe(lambda: _handle_user_group(event, method, resource_id), event)

    return json_response(404, {"error": "Not found"}, event=event)


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


def _safe(
    handler: Any,
    event: Mapping[str, Any],
) -> dict[str, Any]:
    """Execute *handler* with common error handling."""
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
    except Exception as exc:
        logger.exception("Unexpected error in Cognito admin handler")
        return json_response(
            500,
            {"error": "Internal server error", "detail": str(exc)},
            event=event,
        )


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _handle_list_cognito_users(event: Mapping[str, Any]) -> dict[str, Any]:
    """List Cognito users with their group memberships.

    Query parameters:
        limit: 1–60 (default 50)
        pagination_token: opaque token for next page
    """
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 60:
        raise ValidationError("limit must be between 1 and 60", field="limit")

    pagination_token = _query_param(event, "pagination_token")
    client = _cognito_client()
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    list_params: dict[str, Any] = {
        "UserPoolId": user_pool_id,
        "Limit": limit,
    }
    if pagination_token:
        list_params["PaginationToken"] = pagination_token

    try:
        response = client.list_users(**list_params)
    except client.exceptions.InvalidParameterException as exc:
        raise ValidationError(
            "Invalid pagination token", field="pagination_token"
        ) from exc

    users = []
    for user in response.get("Users", []):
        user_data = _serialize_cognito_user(user)
        if user_data:
            username = user.get("Username")
            if username:
                try:
                    groups_response = client.admin_list_groups_for_user(
                        UserPoolId=user_pool_id,
                        Username=username,
                    )
                    user_data["groups"] = [
                        g["GroupName"]
                        for g in groups_response.get("Groups", [])
                    ]
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


def _handle_user_group(
    event: Mapping[str, Any],
    method: str,
    username: Optional[str],
) -> dict[str, Any]:
    """Add or remove a user from a Cognito group."""

    if not username:
        raise ValidationError("username is required", field="username")

    group_name = _parse_group_name(event)
    client = _cognito_client()
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    if method == "POST":
        client.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        _invalidate_user_session(client, user_pool_id, username)
        logger.info(f"Added user {username} to group {group_name}")
        return json_response(
            200, {"status": "added", "group": group_name}, event=event
        )

    if method == "DELETE":
        client.admin_remove_user_from_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group_name,
        )
        _invalidate_user_session(client, user_pool_id, username)
        logger.info(f"Removed user {username} from group {group_name}")
        return json_response(
            200, {"status": "removed", "group": group_name}, event=event
        )

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _handle_delete_cognito_user(
    event: Mapping[str, Any],
    username: str,
) -> dict[str, Any]:
    """Delete a Cognito user and transfer their organizations.

    Steps:
    1. Look up the user's sub in Cognito
    2. Invoke the in-VPC admin Lambda to transfer organizations (DB access)
    3. Sign the user out and delete them from Cognito
    """
    client = _cognito_client()
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    fallback_manager_id = _get_user_sub(event)
    if not fallback_manager_id:
        return json_response(
            401, {"error": "User identity not found"}, event=event
        )

    # 1. Get user's sub from Cognito
    try:
        user_response = client.admin_get_user(
            UserPoolId=user_pool_id,
            Username=username,
        )
    except client.exceptions.UserNotFoundException:
        raise NotFoundError("cognito_user", username)

    user_sub = None
    for attr in user_response.get("UserAttributes", []):
        if attr["Name"] == "sub":
            user_sub = attr["Value"]
            break

    if not user_sub:
        return json_response(
            500, {"error": "User has no sub attribute"}, event=event
        )

    if user_sub == fallback_manager_id:
        return json_response(
            400, {"error": "Cannot delete yourself"}, event=event
        )

    # 2. Invoke admin Lambda to transfer organizations (DB access)
    admin_function_arn = os.getenv("ADMIN_FUNCTION_ARN")
    transferred_count = 0
    if admin_function_arn:
        transferred_count = _invoke_transfer_organizations(
            admin_function_arn,
            user_sub,
            fallback_manager_id,
            _get_user_email(event) or "",
        )
    else:
        logger.warning(
            "ADMIN_FUNCTION_ARN not set – skipping organization transfer"
        )

    # 3. Invalidate session and delete user
    _invalidate_user_session(client, user_pool_id, username)

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


# ---------------------------------------------------------------------------
# Lambda-to-Lambda invocation
# ---------------------------------------------------------------------------


def _invoke_transfer_organizations(
    admin_function_arn: str,
    user_sub: str,
    fallback_manager_id: str,
    caller_email: str,
) -> int:
    """Invoke the in-VPC admin Lambda to transfer organizations.

    Returns:
        Number of organizations transferred.
    """
    lambda_client = boto3.client("lambda")
    payload = {
        "_internal": True,
        "action": "transfer_organizations",
        "user_sub": user_sub,
        "fallback_manager_id": fallback_manager_id,
        "caller_email": caller_email,
    }

    try:
        response = lambda_client.invoke(
            FunctionName=admin_function_arn,
            InvocationType="RequestResponse",
            Payload=json.dumps(payload).encode(),
        )
        response_payload = json.loads(response["Payload"].read())
        if response.get("FunctionError"):
            logger.error(
                f"Admin Lambda returned error: {response_payload}"
            )
            return 0
        return int(response_payload.get("transferred_count", 0))
    except Exception as exc:
        logger.error(f"Failed to invoke admin Lambda: {exc}")
        return 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cognito_client() -> Any:
    """Create a Cognito IDP client with a reasonable timeout."""
    import botocore.config

    config = botocore.config.Config(
        connect_timeout=5,
        read_timeout=10,
        retries={"max_attempts": 2},
    )
    return boto3.client("cognito-idp", config=config)


def _serialize_cognito_user(user: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Serialize a Cognito user for the API response."""
    attributes = {
        attr["Name"]: attr["Value"] for attr in user.get("Attributes", [])
    }

    sub = attributes.get("sub")
    if not sub:
        return None

    last_auth_time = None
    last_auth_time_str = attributes.get("custom:last_auth_time")
    if last_auth_time_str:
        try:
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


def _invalidate_user_session(
    client: Any,
    user_pool_id: str,
    username: str,
) -> None:
    """Sign a user out globally to invalidate cached sessions."""
    try:
        client.admin_user_global_sign_out(
            UserPoolId=user_pool_id,
            Username=username,
        )
        logger.info(f"Invalidated session for user: {username}")
    except Exception:
        # Non-fatal – the session will expire on its own
        logger.warning(
            f"Could not invalidate session for user: {username}",
            exc_info=True,
        )


def _parse_group_name(event: Mapping[str, Any]) -> str:
    """Parse the group name from the request body."""
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


# ---------------------------------------------------------------------------
# Path / authorizer helpers
# ---------------------------------------------------------------------------


def _parse_path(
    path: str,
) -> Tuple[str, str, Optional[str], Optional[str]]:
    """Parse base_path, resource, resource_id, sub_resource from the path."""
    parts = [s for s in path.split("/") if s]
    # Strip version prefix (e.g. "v1")
    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
        parts = parts[1:]
    if not parts:
        return "", "", None, None
    base = parts[0]
    resource = parts[1] if len(parts) > 1 else ""
    rid = parts[2] if len(parts) > 2 else None
    sub = parts[3] if len(parts) > 3 else None
    return base, resource, rid, sub


def _get_authorizer_context(event: Mapping[str, Any]) -> dict[str, Any]:
    """Extract authorizer context from the event."""
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    if "groups" in authorizer or "userSub" in authorizer:
        return {
            "groups": authorizer.get("groups", ""),
            "sub": authorizer.get("userSub", ""),
            "email": authorizer.get("email", ""),
        }
    claims = authorizer.get("claims", {})
    return {
        "groups": claims.get("cognito:groups", ""),
        "sub": claims.get("sub", ""),
        "email": claims.get("email", ""),
    }


def _is_admin(event: Mapping[str, Any]) -> bool:
    ctx = _get_authorizer_context(event)
    groups = ctx.get("groups", "")
    admin_group = os.getenv("ADMIN_GROUP", "admin")
    return admin_group in groups.split(",") if groups else False


def _get_user_sub(event: Mapping[str, Any]) -> Optional[str]:
    ctx = _get_authorizer_context(event)
    return ctx.get("sub") or None


def _get_user_email(event: Mapping[str, Any]) -> Optional[str]:
    ctx = _get_authorizer_context(event)
    return ctx.get("email") or None


def _query_param(event: Mapping[str, Any], name: str) -> Optional[str]:
    params = event.get("queryStringParameters") or {}
    return params.get(name)


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value
