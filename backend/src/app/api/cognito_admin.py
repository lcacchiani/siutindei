"""Cognito user management API handlers.

Runs in a Lambda OUTSIDE the VPC because Cognito disables PrivateLink
when ManagedLogin is configured on the User Pool.

Routes:
    GET    /v1/admin/cognito-users              List users
    DELETE /v1/admin/cognito-users/{username}    Delete user
    POST   /v1/admin/users/{username}/groups     Add to group
    DELETE /v1/admin/users/{username}/groups     Remove from group
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Tuple

import boto3
import botocore.config

from app.exceptions import NotFoundError, ValidationError
from app.utils import json_response, parse_int
from app.utils.logging import configure_logging, get_logger, set_request_context
from app.utils.responses import validate_content_type

configure_logging()
logger = get_logger(__name__)

# Shared boto3 client – reused across warm invocations
_cognito_client: Any = None


def _get_cognito_client() -> Any:
    global _cognito_client
    if _cognito_client is None:
        _cognito_client = boto3.client(
            "cognito-idp",
            config=botocore.config.Config(
                connect_timeout=5,
                read_timeout=10,
                retries={"max_attempts": 2},
            ),
        )
    return _cognito_client


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def _query_param(event: Mapping[str, Any], name: str) -> Optional[str]:
    return (event.get("queryStringParameters") or {}).get(name)


# ------------------------------------------------------------------
# Authorizer helpers
# ------------------------------------------------------------------


def _get_authorizer_context(event: Mapping[str, Any]) -> dict[str, Any]:
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
    return _get_authorizer_context(event).get("sub") or None


# ------------------------------------------------------------------
# Path parsing
# ------------------------------------------------------------------


def _parse_path(path: str) -> Tuple[str, str, Optional[str], Optional[str]]:
    parts = [s for s in path.split("/") if s]
    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
        parts = parts[1:]
    if not parts:
        return "", "", None, None
    base = parts[0]
    resource = parts[1] if len(parts) > 1 else ""
    rid = parts[2] if len(parts) > 2 else None
    sub = parts[3] if len(parts) > 3 else None
    return base, resource, rid, sub


# ------------------------------------------------------------------
# Entrypoint
# ------------------------------------------------------------------


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    request_id = event.get("requestContext", {}).get("requestId", "")
    set_request_context(req_id=request_id)

    method = event.get("httpMethod", "")
    path = event.get("path", "")
    _base, resource, resource_id, sub_resource = _parse_path(path)

    try:
        validate_content_type(event)
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)

    logger.info(f"Cognito admin: {method} {path}")

    if not _is_admin(event):
        return json_response(403, {"error": "Forbidden"}, event=event)

    if resource == "cognito-users" and method == "GET" and not resource_id:
        return _safe(lambda: _list_users(event), event)
    if resource == "cognito-users" and method == "DELETE" and resource_id:
        return _safe(lambda: _delete_user(event, resource_id), event)
    if resource == "users" and sub_resource == "groups":
        return _safe(lambda: _manage_group(event, method, resource_id), event)

    return json_response(404, {"error": "Not found"}, event=event)


def _safe(handler: Any, event: Mapping[str, Any]) -> dict[str, Any]:
    try:
        return handler()
    except ValidationError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except NotFoundError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except ValueError as exc:
        return json_response(400, {"error": str(exc)}, event=event)
    except Exception as exc:
        logger.exception("Unexpected error in Cognito admin handler")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


# ------------------------------------------------------------------
# List users
# ------------------------------------------------------------------


def _list_users(event: Mapping[str, Any]) -> dict[str, Any]:
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 60:
        raise ValidationError("limit must be between 1 and 60", field="limit")

    pagination_token = _query_param(event, "pagination_token")
    client = _get_cognito_client()
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    params: dict[str, Any] = {"UserPoolId": user_pool_id, "Limit": limit}
    if pagination_token:
        params["PaginationToken"] = pagination_token

    try:
        response = client.list_users(**params)
    except client.exceptions.InvalidParameterException as exc:
        detail = str(exc)
        logger.warning(f"Cognito list_users error: {detail}")
        if pagination_token:
            raise ValidationError(
                "Invalid pagination token", field="pagination_token"
            ) from exc
        raise ValidationError(f"Cognito error: {detail}") from exc

    users = []
    for user in response.get("Users", []):
        data = _serialize_user(user)
        if not data:
            continue
        username = user.get("Username")
        if username:
            try:
                gr = client.admin_list_groups_for_user(
                    UserPoolId=user_pool_id, Username=username
                )
                data["groups"] = [g["GroupName"] for g in gr.get("Groups", [])]
            except Exception:
                data["groups"] = []
        else:
            data["groups"] = []
        users.append(data)

    result: dict[str, Any] = {"items": users}
    next_token = response.get("PaginationToken")
    if next_token:
        result["pagination_token"] = next_token

    logger.info(f"Listed {len(users)} Cognito users")
    return json_response(200, result, event=event)


# ------------------------------------------------------------------
# Manage groups
# ------------------------------------------------------------------


def _manage_group(
    event: Mapping[str, Any], method: str, username: Optional[str]
) -> dict[str, Any]:
    if not username:
        raise ValidationError("username is required", field="username")

    group_name = _parse_group_name(event)
    client = _get_cognito_client()
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    if method == "POST":
        client.admin_add_user_to_group(
            UserPoolId=user_pool_id, Username=username, GroupName=group_name
        )
        _invalidate_session(client, user_pool_id, username)
        logger.info(f"Added {username} to {group_name}")
        return json_response(200, {"status": "added", "group": group_name}, event=event)

    if method == "DELETE":
        client.admin_remove_user_from_group(
            UserPoolId=user_pool_id, Username=username, GroupName=group_name
        )
        _invalidate_session(client, user_pool_id, username)
        logger.info(f"Removed {username} from {group_name}")
        return json_response(
            200, {"status": "removed", "group": group_name}, event=event
        )

    return json_response(405, {"error": "Method not allowed"}, event=event)


# ------------------------------------------------------------------
# Delete user
# ------------------------------------------------------------------


def _delete_user(event: Mapping[str, Any], username: str) -> dict[str, Any]:
    client = _get_cognito_client()
    user_pool_id = _require_env("COGNITO_USER_POOL_ID")

    fallback_manager_id = _get_user_sub(event)
    if not fallback_manager_id:
        return json_response(401, {"error": "User identity not found"}, event=event)

    try:
        user_response = client.admin_get_user(
            UserPoolId=user_pool_id, Username=username
        )
    except client.exceptions.UserNotFoundException:
        raise NotFoundError("cognito_user", username)

    user_sub = None
    for attr in user_response.get("UserAttributes", []):
        if attr["Name"] == "sub":
            user_sub = attr["Value"]
            break

    if not user_sub:
        return json_response(500, {"error": "User has no sub attribute"}, event=event)
    if user_sub == fallback_manager_id:
        return json_response(400, {"error": "Cannot delete yourself"}, event=event)

    # Invoke the in-VPC admin Lambda to transfer organisations
    admin_fn = os.getenv("ADMIN_FUNCTION_ARN")
    transferred_count = 0
    if admin_fn:
        transferred_count = _invoke_transfer_orgs(
            admin_fn, user_sub, fallback_manager_id
        )

    _invalidate_session(client, user_pool_id, username)
    client.admin_delete_user(UserPoolId=user_pool_id, Username=username)
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


def _invoke_transfer_orgs(
    admin_fn_arn: str, user_sub: str, fallback_manager_id: str
) -> int:
    lam = boto3.client("lambda")
    payload = {
        "_internal": True,
        "action": "transfer_organizations",
        "user_sub": user_sub,
        "fallback_manager_id": fallback_manager_id,
    }
    try:
        resp = lam.invoke(
            FunctionName=admin_fn_arn,
            InvocationType="RequestResponse",
            Payload=json.dumps(payload).encode(),
        )
        body = json.loads(resp["Payload"].read())
        if resp.get("FunctionError"):
            logger.error(f"Admin Lambda error: {body}")
            return 0
        return int(body.get("transferred_count", 0))
    except Exception as exc:
        logger.error(f"Failed to invoke admin Lambda: {exc}")
        return 0


# ------------------------------------------------------------------
# Shared helpers
# ------------------------------------------------------------------


def _serialize_user(user: dict[str, Any]) -> Optional[dict[str, Any]]:
    attrs = {a["Name"]: a["Value"] for a in user.get("Attributes", [])}
    sub = attrs.get("sub")
    if not sub:
        return None

    last_auth_time = None
    raw = attrs.get("custom:last_auth_time")
    if raw:
        try:
            last_auth_time = datetime.fromtimestamp(
                int(raw), tz=timezone.utc
            ).isoformat()
        except (ValueError, TypeError):
            pass

    return {
        "sub": sub,
        "email": attrs.get("email"),
        "email_verified": attrs.get("email_verified") == "true",
        "name": attrs.get("name"),
        "given_name": attrs.get("given_name"),
        "family_name": attrs.get("family_name"),
        "username": user.get("Username"),
        "status": user.get("UserStatus"),
        "enabled": user.get("Enabled", True),
        "created_at": user.get("UserCreateDate"),
        "updated_at": user.get("UserLastModifiedDate"),
        "last_auth_time": last_auth_time,
    }


def _invalidate_session(client: Any, user_pool_id: str, username: str) -> None:
    try:
        client.admin_user_global_sign_out(
            UserPoolId=user_pool_id, Username=username
        )
    except Exception:
        logger.warning(f"Could not invalidate session for {username}", exc_info=True)


def _parse_group_name(event: Mapping[str, Any]) -> str:
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
