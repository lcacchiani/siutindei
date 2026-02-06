"""Lambda entrypoint for Cognito user management APIs.

This Lambda runs OUTSIDE the VPC so it can reach the Cognito public API
endpoints.  Database operations are delegated to the in-VPC admin Lambda
via Lambda-to-Lambda invocation.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.api.cognito_admin import lambda_handler as _handler


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Delegate to Cognito admin handler."""

    return _handler(event, context)
