"""Shared helpers for API Gateway authorizer Lambdas."""

from __future__ import annotations

from typing import Any


def get_header(headers: dict[str, Any], name: str) -> str:
    """Get a header value case-insensitively."""
    for key, value in headers.items():
        if key.lower() == name.lower():
            return str(value)
    return ''


def extract_token(headers: dict[str, Any]) -> str | None:
    """Extract the JWT token from the Authorization header."""
    auth_header = get_header(headers, 'authorization')
    if not auth_header:
        return None

    if auth_header.lower().startswith('bearer '):
        return auth_header[7:].strip()
    return auth_header.strip()


def policy(
    effect: str,
    method_arn: str,
    principal_id: str,
    context: dict[str, Any],
    *,
    broaden_resource: bool = True,
) -> dict[str, Any]:
    """Build an IAM policy document for API Gateway."""
    resource = method_arn
    if effect == 'Allow' and broaden_resource:
        parts = method_arn.split('/')
        if len(parts) >= 2:
            resource = '/'.join(parts[:2]) + '/*'

    return {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource,
                }
            ],
        },
        'context': context,
    }
