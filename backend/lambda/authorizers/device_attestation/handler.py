"""API Gateway request authorizer for device attestation."""

from __future__ import annotations

from typing import Any, Dict

from app.auth.attestation import is_attestation_enabled, verify_attestation_token


def _get_header(headers: Dict[str, Any], name: str) -> str:
    for key, value in headers.items():
        if key.lower() == name.lower():
            return str(value)
    return ""


def _policy(effect: str, method_arn: str, principal_id: str, context: Dict[str, Any]):
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
    headers = event.get("headers") or {}
    method_arn = event.get("methodArn", "")
    token = _get_header(headers, "x-device-attestation")

    if not is_attestation_enabled():
        return _policy("Allow", method_arn, "bypass", {"bypass": "true"})
    if not token:
        return _policy("Deny", method_arn, "anonymous", {"reason": "missing_token"})

    try:
        decoded = verify_attestation_token(token)
        if decoded.get("bypass"):
            return _policy("Allow", method_arn, "bypass", {"bypass": "true"})
        principal = decoded.get("sub", "device")
        return _policy("Allow", method_arn, principal, {"attested": "true"})
    except Exception as exc:
        return _policy("Deny", method_arn, "invalid", {"reason": str(exc)})
