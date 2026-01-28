"""API Gateway request authorizer for device attestation.

This Lambda validates device attestation tokens for mobile API requests,
ensuring only legitimate app instances can access the API.
"""

from __future__ import annotations

from typing import Any, Dict

from app.auth.attestation import is_attestation_enabled, verify_attestation_token
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def _get_header(headers: Dict[str, Any], name: str) -> str:
    """Get a header value case-insensitively."""

    for key, value in headers.items():
        if key.lower() == name.lower():
            return str(value)
    return ""


def _policy(
    effect: str,
    method_arn: str,
    principal_id: str,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Build an IAM policy document for API Gateway."""

    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": method_arn,
                }
            ],
        },
        "context": context,
    }


def lambda_handler(event, _context):
    """Authorize requests based on device attestation token."""

    headers = event.get("headers") or {}
    method_arn = event.get("methodArn", "")
    token = _get_header(headers, "x-device-attestation")

    # If attestation is not configured, allow all requests (dev mode)
    if not is_attestation_enabled():
        logger.debug("Device attestation disabled, allowing request")
        return _policy("Allow", method_arn, "bypass", {"bypass": "true"})

    # Require token when attestation is enabled
    if not token:
        logger.warning("Missing device attestation token")
        return _policy("Deny", method_arn, "anonymous", {"reason": "missing_token"})

    try:
        decoded = verify_attestation_token(token)

        # Handle bypass mode (for testing)
        if decoded.get("bypass"):
            logger.debug("Device attestation bypassed")
            return _policy("Allow", method_arn, "bypass", {"bypass": "true"})

        principal = decoded.get("sub", "device")
        logger.info(f"Device attestation verified for {principal}")
        return _policy("Allow", method_arn, principal, {"attested": "true"})

    except Exception as exc:
        logger.warning(f"Device attestation failed: {exc}")
        return _policy("Deny", method_arn, "invalid", {"reason": str(exc)})
