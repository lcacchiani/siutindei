"""Seeding helpers for migrations Lambda."""

from __future__ import annotations

import os
from pathlib import Path

from app.services.aws_clients import get_cognito_idp_client
from app.utils.logging import get_logger

from .utils import _psycopg_connect

logger = get_logger(__name__)


def _run_seed(
    database_url: str, seed_path: str, manager_sub: str | None = None
) -> None:
    """Run seed SQL if the file exists."""
    path = Path(seed_path)
    if not path.exists():
        return

    seed_sql = path.read_text(encoding="utf-8")
    if not seed_sql.strip():
        return

    if manager_sub:
        seed_sql = seed_sql.replace("{{SEED_MANAGER_SUB}}", manager_sub)

    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(seed_sql)
        connection.commit()


def _get_or_create_seed_manager() -> str:
    """Get or create a test manager user for seed data."""
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
    if not user_pool_id:
        raise RuntimeError("COGNITO_USER_POOL_ID environment variable is required")

    client = get_cognito_idp_client()
    seed_email = "test@lx-software.com"

    import secrets
    import string

    alphabet = string.ascii_letters + string.digits + "!@#$%"
    seed_password = "".join(secrets.choice(alphabet) for _ in range(16))

    try:
        response = client.list_users(
            UserPoolId=user_pool_id,
            Filter=f'email = "{seed_email}"',
            Limit=1,
        )
        users = response.get("Users", [])

        if users:
            user = users[0]
            attributes = {
                attr["Name"]: attr["Value"] for attr in user.get("Attributes", [])
            }
            sub = attributes.get("sub")
            if sub:
                logger.info(f"Found existing seed manager user: {seed_email}")
                return sub
    except Exception as exc:
        logger.warning(f"Error checking for existing user: {exc}")

    try:
        response = client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=seed_email,
            TemporaryPassword=seed_password,
            MessageAction="SUPPRESS",
            UserAttributes=[
                {"Name": "email", "Value": seed_email},
                {"Name": "email_verified", "Value": "true"},
            ],
        )

        client.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username=seed_email,
            Password=seed_password,
            Permanent=True,
        )

        try:
            client.admin_add_user_to_group(
                UserPoolId=user_pool_id,
                Username=seed_email,
                GroupName="manager",
            )
        except client.exceptions.ResourceNotFoundException:
            logger.warning("Manager group not found, skipping group assignment")

        user = response.get("User", {})
        attributes = {
            attr["Name"]: attr["Value"] for attr in user.get("Attributes", [])
        }
        sub = attributes.get("sub")

        if not sub:
            raise RuntimeError("Created user does not have a sub attribute")

        logger.info(f"Created seed manager user: {seed_email} with sub: {sub}")
        return sub

    except client.exceptions.UsernameExistsException:
        response = client.list_users(
            UserPoolId=user_pool_id,
            Filter=f'email = "{seed_email}"',
            Limit=1,
        )
        users = response.get("Users", [])
        if users:
            attributes = {
                attr["Name"]: attr["Value"] for attr in users[0].get("Attributes", [])
            }
            sub = attributes.get("sub")
            if sub:
                return sub
        raise RuntimeError(f"Could not get sub for seed manager user: {seed_email}")
