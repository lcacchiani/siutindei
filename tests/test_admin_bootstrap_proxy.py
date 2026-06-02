"""Tests that admin bootstrap routes Cognito through the AWS proxy."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ADMIN_BOOTSTRAP_DIR = (
    Path(__file__).resolve().parents[1] / 'backend' / 'lambda' / 'admin_bootstrap'
)
sys.path.insert(0, str(ADMIN_BOOTSTRAP_DIR))

import handler as bootstrap_handler  # noqa: E402


@pytest.mark.parametrize(
    'action',
    [
        'admin_create_user',
        'admin_set_user_password',
        'admin_add_user_to_group',
    ],
)
def test_admin_bootstrap_uses_aws_proxy(action: str) -> None:
    calls: list[tuple[str, str]] = []

    def fake_proxy(service: str, proxy_action: str, params: dict) -> dict:
        calls.append((service, proxy_action))
        if proxy_action == 'admin_create_user':
            return {
                'User': {
                    'Attributes': [{'Name': 'sub', 'Value': 'user-sub-123'}],
                },
            }
        return {}

    event = {
        'RequestType': 'Create',
        'ResourceProperties': {
            'UserPoolId': 'pool-1',
            'Email': 'admin@example.com',
            'TempPassword': 'TempPass123!',
            'GroupName': 'admin',
        },
    }

    with patch.object(bootstrap_handler, 'aws_proxy', side_effect=fake_proxy):
        with patch.object(
            bootstrap_handler,
            'send_cfn_response',
            return_value=None,
        ):
            bootstrap_handler.lambda_handler(event, None)

    assert ('cognito-idp', action) in calls
