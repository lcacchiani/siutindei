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

import importlib
from typing import Any

from app.auth.jwt_validator import (
    JWTValidationError,
    decode_and_verify_token,
)
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

_common = importlib.import_module("lambda.authorizers._common")
_extract_token = _common.extract_token
_policy = _common.policy


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
