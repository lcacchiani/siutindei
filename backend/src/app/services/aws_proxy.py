"""AWS API proxy – handler and client.

The *handler* runs in a Lambda outside the VPC and executes allow-listed
boto3 calls on behalf of callers that cannot reach the public AWS APIs
(e.g. Cognito with ManagedLogin blocks PrivateLink).

The *client* is imported by in-VPC Lambdas to invoke the proxy via
Lambda-to-Lambda.

Environment (proxy Lambda):
    ALLOWED_ACTIONS  Comma-separated ``service:action`` pairs, e.g.
                     ``cognito-idp:list_users,cognito-idp:admin_get_user``
"""

from __future__ import annotations

import json
import os
from typing import Any, Mapping

import boto3

from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


# ======================================================================
# Proxy handler (runs in the proxy Lambda outside VPC)
# ======================================================================

_ALLOWED_ACTIONS: set[str] | None = None


def _get_allowed_actions() -> set[str]:
    global _ALLOWED_ACTIONS
    if _ALLOWED_ACTIONS is None:
        raw = os.getenv("ALLOWED_ACTIONS", "")
        _ALLOWED_ACTIONS = {a.strip() for a in raw.split(",") if a.strip()}
    return _ALLOWED_ACTIONS


def proxy_handler(event: Mapping[str, Any], _context: Any) -> dict[str, Any]:
    """Execute an allow-listed boto3 call and return the result."""

    service: str = event.get("service", "")
    action: str = event.get("action", "")
    params: dict[str, Any] = event.get("params") or {}

    key = f"{service}:{action}"
    allowed = _get_allowed_actions()

    if key not in allowed:
        logger.warning(f"Blocked disallowed action: {key}")
        return {
            "error": {
                "code": "ActionNotAllowed",
                "message": f"{key} is not in the proxy allow-list",
            },
        }

    logger.info(f"Proxying {key}")

    try:
        client = boto3.client(service)
        method = getattr(client, action, None)
        if method is None:
            return {
                "error": {
                    "code": "InvalidAction",
                    "message": f"{action} is not a valid method on {service}",
                },
            }
        result = method(**params)
        # Strip SDK metadata – not useful to the caller
        result.pop("ResponseMetadata", None)
        # Round-trip through JSON to normalise datetimes / Decimals
        return {"result": json.loads(json.dumps(result, default=str))}
    except Exception as exc:
        code = (
            getattr(exc, "response", {})
            .get("Error", {})
            .get("Code", type(exc).__name__)
        )
        message = str(exc)
        logger.warning(f"Proxy call {key} failed: {code}: {message}")
        return {"error": {"code": code, "message": message}}


# ======================================================================
# Client (imported by in-VPC Lambdas)
# ======================================================================


class AwsProxyError(Exception):
    """Raised when the proxy returns an error."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


# Module-level cache
_lambda_client: Any = None
_proxy_arn: str | None = None


def invoke(service: str, action: str, params: dict[str, Any]) -> dict[str, Any]:
    """Call an AWS API via the proxy Lambda.

    Returns:
        The boto3 response dict (without ``ResponseMetadata``).

    Raises:
        AwsProxyError: If the proxy returns an error.
        RuntimeError:  If the proxy ARN is not configured.
    """
    global _lambda_client, _proxy_arn

    if _proxy_arn is None:
        _proxy_arn = os.getenv("AWS_PROXY_FUNCTION_ARN", "")
    if not _proxy_arn:
        raise RuntimeError("AWS_PROXY_FUNCTION_ARN is not configured")

    if _lambda_client is None:
        _lambda_client = boto3.client("lambda")

    payload = {"service": service, "action": action, "params": params}

    resp = _lambda_client.invoke(
        FunctionName=_proxy_arn,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode(),
    )

    body = json.loads(resp["Payload"].read())

    if resp.get("FunctionError"):
        raise AwsProxyError("LambdaInvocationError", str(body))

    err = body.get("error")
    if err:
        raise AwsProxyError(err.get("code", "Unknown"), err.get("message", ""))

    return body.get("result", {})
