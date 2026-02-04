"""API Gateway request authorizer for any authenticated Cognito user.

This Lambda validates JWT tokens with proper signature verification and allows
access to any authenticated user, regardless of their Cognito group membership.

SECURITY NOTES:
- JWT signatures are verified using Cognito's JWKS endpoint
- Token expiration is validated to prevent replay attacks
- Issuer is verified to prevent token confusion attacks

Use this for endpoints that require authentication but not specific role-based
permissions.
"""

from __future__ import annotations

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
    """Authorize requests for any authenticated Cognito user.

    This authorizer:
    1. Extracts the JWT token from the Authorization header
    2. Verifies the token signature using Cognito's JWKS
    3. Validates token expiration and issuer
    4. Grants access to any valid authenticated user

    Args:
        event: API Gateway authorizer event containing headers and methodArn
        _context: Lambda context (unused)

    Returns:
        IAM policy document allowing or denying the request
    """
    headers = event.get("headers") or {}
    method_arn = event.get("methodArn", "")

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
        user_groups = claims.groups

        logger.info(
            f"Access granted for authenticated user {user_sub[:8]}*** "
            f"(groups: {', '.join(user_groups) if user_groups else 'none'})"
        )

        return _policy(
            "Allow",
            method_arn,
            user_sub,
            {
                "userSub": user_sub,
                "email": email,
                "groups": ",".join(user_groups),
            },
        )

    except JWTValidationError as exc:
        logger.warning(f"JWT validation failed: {exc.message} (reason: {exc.reason})")
        return _policy("Deny", method_arn, "invalid", {"reason": exc.reason})
    except Exception as exc:
        # SECURITY: Don't expose internal error details
        logger.warning(f"Token validation failed: {type(exc).__name__}")
        return _policy("Deny", method_arn, "invalid", {"reason": "invalid_token"})
