"""Lambda entrypoint for Cognito user management APIs.

This Lambda runs OUTSIDE the VPC so it can reach the Cognito API.
Cognito disables PrivateLink when ManagedLogin is configured, so a
VPC endpoint cannot be used.  Database operations (e.g. transferring
organisations during user deletion) are delegated to the in-VPC admin
Lambda via synchronous Lambda invocation.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.api.cognito_admin import lambda_handler as _handler


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    return _handler(event, context)
