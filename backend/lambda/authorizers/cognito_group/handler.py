"""API Gateway request authorizer for Cognito group-based access control.

This Lambda validates JWT tokens with proper signature verification and checks
if the user belongs to the required Cognito groups before allowing access.

SECURITY NOTES:
- JWT signatures are verified using Cognito's JWKS endpoint
- Token expiration is validated to prevent replay attacks
- Issuer is verified to prevent token confusion attacks

Environment Variables:
    ALLOWED_GROUPS: Comma-separated list of groups that can access the endpoint
                    (e.g., "admin" or "admin,manager")
"""

from __future__ import annotations

import os
from typing import Any

from app.auth.jwt_validator import (
    JWTValidationError,
    decode_and_verify_token,
)
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def _get_header(headers: dict[str, Any], name: str) -> str:
    """Get a header value case-insensitively."""
    for key, value in headers.items():
        if key.lower() == name.lower():
            return str(value)
    return ""


def _extract_token(headers: dict[str, Any]) -> str | None:
    """Extract the JWT token from the Authorization header."""
    auth_header = _get_header(headers, "authorization")
    if not auth_header:
        return None

    # Handle "Bearer <token>" format
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()

    return auth_header.strip()


def _policy(
    effect: str,
    method_arn: str,
    principal_id: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    """Build an IAM policy document for API Gateway.

    For Allow policies, we allow all methods on this API to enable
    policy caching across endpoints.
    """
    # For Allow, broaden the resource to enable caching
    if effect == "Allow":
        # Convert specific method ARN to wildcard for caching
        # arn:aws:execute-api:region:account:api-id/stage/METHOD/path
        # -> arn:aws:execute-api:region:account:api-id/stage/*
        parts = method_arn.split("/")
        if len(parts) >= 2:
            resource = "/".join(parts[:2]) + "/*"
        else:
            resource = method_arn
    else:
        resource = method_arn

    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                }
            ],
        },
        "context": context,
    }


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Authorize requests based on Cognito group membership.

    This authorizer:
    1. Extracts the JWT token from the Authorization header
    2. Verifies the token signature using Cognito's JWKS
    3. Validates token expiration and issuer
    4. Checks if the user belongs to any of the allowed groups

    Args:
        event: API Gateway authorizer event containing headers and methodArn
        _context: Lambda context (unused)

    Returns:
        IAM policy document allowing or denying the request
    """
    headers = event.get("headers") or {}
    method_arn = event.get("methodArn", "")

    # Get configuration
    allowed_groups_str = os.getenv("ALLOWED_GROUPS", "")
    if not allowed_groups_str:
        logger.error("ALLOWED_GROUPS environment variable not configured")
        return _policy("Deny", method_arn, "misconfigured", {"reason": "misconfigured"})

    allowed_groups = {g.strip() for g in allowed_groups_str.split(",") if g.strip()}

    # Extract token from Authorization header
    token = _extract_token(headers)
    if not token:
        logger.warning("Missing or invalid Authorization header")
        return _policy("Deny", method_arn, "anonymous", {"reason": "missing_token"})

    try:
        # Verify and decode the JWT token with signature validation
        claims = decode_and_verify_token(token)

        user_sub = claims.sub
        email = claims.email
        user_groups = set(claims.groups)

        # Check if user is in any of the allowed groups
        matching_groups = user_groups & allowed_groups

        if matching_groups:
            logger.info(
                f"Access granted for user {user_sub[:8]}*** "
                f"(groups: {', '.join(matching_groups)})"
            )
            return _policy(
                "Allow",
                method_arn,
                user_sub,
                {
                    "userSub": user_sub,
                    "email": email,
                    "groups": ",".join(user_groups),
                    "matchedGroups": ",".join(matching_groups),
                },
            )
        else:
            logger.warning(
                f"Access denied for user {user_sub[:8]}*** "
                f"(user groups: {user_groups}, required: {allowed_groups})"
            )
            return _policy(
                "Deny",
                method_arn,
                user_sub,
                {"reason": "insufficient_permissions", "userSub": user_sub},
            )

    except JWTValidationError as exc:
        logger.warning(f"JWT validation failed: {exc.message} (reason: {exc.reason})")
        return _policy("Deny", method_arn, "invalid", {"reason": exc.reason})
    except Exception as exc:
        # SECURITY: Don't expose internal error details
        logger.warning(f"Token validation failed: {type(exc).__name__}")
        return _policy("Deny", method_arn, "invalid", {"reason": "invalid_token"})
