"""Tests for the admin Cognito user listing call pattern.

The listing must resolve group membership with a constant number of proxy
hops (one ``list_users`` plus one ``list_users_in_group`` per managed
group) rather than one ``admin_list_groups_for_user`` per user.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.api import admin_cognito
from app.services.aws_proxy import AwsProxyError


def _user(username: str, sub: str) -> dict[str, Any]:
    return {
        'Username': username,
        'UserStatus': 'CONFIRMED',
        'Enabled': True,
        'Attributes': [
            {'Name': 'sub', 'Value': sub},
            {'Name': 'email', 'Value': f'{username}@example.com'},
        ],
    }


def _event(**query: str) -> dict[str, Any]:
    return {
        'httpMethod': 'GET',
        'path': '/v1/admin/cognito-users',
        'queryStringParameters': query or None,
        'headers': {},
        'requestContext': {'requestId': 'req-1', 'authorizer': {}},
    }


@pytest.fixture(autouse=True)
def _cognito_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('COGNITO_USER_POOL_ID', 'pool-1')
    monkeypatch.delenv('ADMIN_GROUP', raising=False)
    monkeypatch.delenv('MANAGER_GROUP', raising=False)


def _patch_proxy(monkeypatch: pytest.MonkeyPatch, responder) -> list[tuple]:
    calls: list[tuple[str, dict[str, Any]]] = []

    def fake_proxy(service: str, action: str, params: dict) -> dict:
        assert service == 'cognito-idp'
        calls.append((action, params))
        return responder(action, params)

    monkeypatch.setattr(admin_cognito, 'aws_proxy', fake_proxy)
    return calls


def test_list_users_uses_constant_number_of_proxy_calls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    users = [_user(f'user{i}', f'{i:08d}-0000-0000-0000-000000000000') for i in range(6)]

    def responder(action: str, params: dict) -> dict:
        if action == 'list_users':
            return {'Users': users}
        if action == 'list_users_in_group':
            if params['GroupName'] == 'admin':
                return {'Users': [users[0]]}
            return {'Users': [users[0], users[3]]}
        raise AssertionError(f'unexpected action {action}')

    calls = _patch_proxy(monkeypatch, responder)

    response = admin_cognito._handle_list_cognito_users(_event())

    actions = [action for action, _ in calls]
    assert actions == ['list_users', 'list_users_in_group', 'list_users_in_group']
    assert 'admin_list_groups_for_user' not in actions
    assert 'admin_get_user' not in actions

    body = json.loads(response['body'])
    groups = {item['username']: item['groups'] for item in body['items']}
    assert groups['user0'] == ['admin', 'manager']
    assert groups['user3'] == ['manager']
    assert groups['user1'] == []
    assert response['statusCode'] == 200


def test_group_listing_follows_pagination(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def responder(action: str, params: dict) -> dict:
        if action == 'list_users':
            return {'Users': [_user('a', 'aaaaaaaa-0000-0000-0000-000000000000')]}
        if params['GroupName'] == 'manager':
            return {'Users': []}
        if 'NextToken' not in params:
            return {'Users': [_user('a', 'x')], 'NextToken': 'page-2'}
        assert params['NextToken'] == 'page-2'
        return {'Users': []}

    calls = _patch_proxy(monkeypatch, responder)

    response = admin_cognito._handle_list_cognito_users(_event())

    admin_calls = [
        params
        for action, params in calls
        if action == 'list_users_in_group' and params['GroupName'] == 'admin'
    ]
    assert len(admin_calls) == 2
    assert all(p['Limit'] == admin_cognito.GROUP_MEMBERS_PAGE_SIZE for p in admin_calls)
    body = json.loads(response['body'])
    assert body['items'][0]['groups'] == ['admin']


def test_group_lookup_failure_degrades_to_empty_groups(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def responder(action: str, params: dict) -> dict:
        if action == 'list_users':
            return {'Users': [_user('a', 'aaaaaaaa-0000-0000-0000-000000000000')]}
        if params['GroupName'] == 'admin':
            raise AwsProxyError('TooManyRequestsException', 'slow down')
        return {'Users': [_user('a', 'x')]}

    _patch_proxy(monkeypatch, responder)

    response = admin_cognito._handle_list_cognito_users(_event())

    body = json.loads(response['body'])
    assert response['statusCode'] == 200
    assert body['items'][0]['groups'] == ['manager']


def test_managed_group_names_respect_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('ADMIN_GROUP', 'ops')
    monkeypatch.setenv('MANAGER_GROUP', 'ops')
    assert admin_cognito._managed_group_names() == ['ops']
