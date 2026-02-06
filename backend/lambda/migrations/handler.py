"""Lambda handler to run Alembic migrations and seed data.

SECURITY NOTES:
- Database credentials are never logged
- Only safe connection metadata (host, port, database name) is logged
- Uses structured logging for CloudWatch integration
"""

from __future__ import annotations

import base64
import json
import os
import time
from pathlib import Path
from typing import Any
from typing import Mapping
from urllib.parse import urlparse

import boto3
import psycopg
from psycopg import sql
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from app.db.connection import get_database_url
from app.utils.cfn_response import send_cfn_response
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)
_SECRET_CACHE: dict[str, dict[str, Any]] = {}
_ALLOWED_PROXY_USERS = {"siutindei_app", "siutindei_admin"}


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle CloudFormation custom resource events or direct invocations.

    Supports two modes:
    1. CloudFormation custom resource (has RequestType) - runs migrations
    2. Direct invocation with {"action": "seed"} - runs seeding only
    """
    # Check if this is a direct invocation for seeding
    if event.get("action") == "seed":
        return _handle_seed_only(event, context)

    request_type = event.get("RequestType")
    physical_id = str(event.get("PhysicalResourceId") or "migrations")
    resource_props = event.get("ResourceProperties", {})

    if request_type == "Delete":
        logger.info("Delete request received, skipping migrations")
        data = {"status": "skipped"}
        send_cfn_response(event, context, "SUCCESS", data, physical_id)
        return {"PhysicalResourceId": physical_id, "Data": data}

    try:
        database_url = get_database_url()

        # SECURITY: Log connection details without password for debugging
        parsed = urlparse(database_url)
        logger.info(
            f"Connecting to database: host={parsed.hostname}, port={parsed.port}, "
            f"user={parsed.username}, database={parsed.path.lstrip('/')}"
        )

        _run_with_retry(_run_migrations, database_url)
        _run_with_retry(_sync_proxy_user_passwords, database_url)
        _run_with_retry(_sync_active_countries, database_url)

        run_seed = _truthy(resource_props.get("RunSeed"))
        if run_seed:
            seed_path = os.getenv(
                "SEED_FILE_PATH",
                "/var/task/db/seed/seed_data.sql",
            )
            # Create or get seed manager user for demo data
            seed_manager_sub = _get_or_create_seed_manager()
            _run_with_retry(_run_seed, database_url, seed_path, seed_manager_sub)

        logger.info("Migrations completed successfully")
        data = {"status": "ok"}
        send_cfn_response(event, context, "SUCCESS", data, physical_id)
        return {"PhysicalResourceId": physical_id, "Data": data}
    except Exception as exc:
        # Extract meaningful error message for CloudFormation
        error_type = type(exc).__name__
        error_msg = str(exc)
        # Truncate error message but include error type for debugging
        truncated_msg = error_msg[:200] if len(error_msg) > 200 else error_msg
        reason = f"{error_type}: {truncated_msg}"
        logger.error(
            "Migrations failed",
            extra={"error_type": error_type, "error_message": error_msg},
            exc_info=True,
        )
        data = {"status": "failed", "error_type": error_type}
        send_cfn_response(
            event,
            context,
            "FAILED",
            data,
            physical_id,
            reason,
        )
        return {"PhysicalResourceId": physical_id, "Data": data}


def _handle_seed_only(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Handle direct invocation for seeding only (not via CloudFormation).

    This allows seeding to be run as a separate step after CloudFormation
    deployment completes, so seeding failures don't roll back the stack.

    The event can optionally include:
    - seed_manager_sub: Pre-created Cognito user sub to use as manager_id.
      This is required when running from GitHub Actions because the Lambda
      runs in a VPC with isolated subnets and cannot access Cognito APIs
      when ManagedLogin is enabled (PrivateLink access is disabled).
    """
    logger.info("Running seed-only mode (direct invocation)")

    try:
        database_url = get_database_url()

        seed_path = os.getenv(
            "SEED_FILE_PATH",
            "/var/task/db/seed/seed_data.sql",
        )

        # Use provided seed_manager_sub or create user (if Cognito access available)
        seed_manager_sub = event.get("seed_manager_sub")
        if not seed_manager_sub:
            logger.info("No seed_manager_sub provided, attempting to create user")
            seed_manager_sub = _get_or_create_seed_manager()
        else:
            logger.info(f"Using provided seed_manager_sub: {seed_manager_sub}")

        _run_with_retry(_run_seed, database_url, seed_path, seed_manager_sub)

        logger.info("Seeding completed successfully")
        return {"status": "ok", "action": "seed"}

    except Exception as exc:
        error_type = type(exc).__name__
        error_msg = str(exc)
        logger.error(
            "Seeding failed",
            extra={"error_type": error_type, "error_message": error_msg},
            exc_info=True,
        )
        return {"status": "failed", "action": "seed", "error": str(exc)}


def _run_migrations(database_url: str) -> None:
    """Run Alembic migrations to the latest head."""

    config = Config()
    config.set_main_option("script_location", "/var/task/db/alembic")
    config.set_main_option("sqlalchemy.url", _escape_config(database_url))
    command.upgrade(config, "head")


def _run_seed(
    database_url: str, seed_path: str, manager_sub: str | None = None
) -> None:
    """Run seed SQL if the file exists.

    Args:
        database_url: Database connection URL
        seed_path: Path to the seed SQL file
        manager_sub: Cognito user sub to use as manager_id for organizations
    """
    path = Path(seed_path)
    if not path.exists():
        return

    seed_sql = path.read_text(encoding="utf-8")
    if not seed_sql.strip():
        return

    # Replace placeholder with actual manager sub if provided
    if manager_sub:
        seed_sql = seed_sql.replace("{{SEED_MANAGER_SUB}}", manager_sub)

    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(seed_sql)
        connection.commit()


def _sync_proxy_user_passwords(database_url: str) -> None:
    """Ensure proxy user passwords match Secrets Manager values."""

    secret_arns = [
        os.getenv("DATABASE_APP_USER_SECRET_ARN"),
        os.getenv("DATABASE_ADMIN_USER_SECRET_ARN"),
    ]
    user_secrets = []
    for secret_arn in secret_arns:
        if secret_arn:
            user_secrets.append(_load_db_user_secret(secret_arn))

    if not user_secrets:
        return

    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            for username, password in user_secrets:
                _validate_db_username(username)
                cursor.execute(
                    "SELECT 1 FROM pg_roles WHERE rolname = %s",
                    (username,),
                )
                if cursor.fetchone() is None:
                    raise RuntimeError(f"Database role {username} does not exist")
                # ALTER ROLE PASSWORD doesn't support parameterized queries in PostgreSQL
                # Use psycopg.sql module for safe query composition
                alter_query = sql.SQL("ALTER ROLE {} PASSWORD {}").format(
                    sql.Identifier(username),
                    sql.Literal(password),
                )
                cursor.execute(alter_query)
                logger.info(
                    "Updated database password for proxy user",
                    extra={"db_user": username},
                )
        connection.commit()


def _sync_active_countries(database_url: str) -> None:
    """Sync geographic_areas active flags based on ACTIVE_COUNTRY_CODES env var.

    Reads the comma-separated list of ISO 3166-1 alpha-2 codes from the
    environment and ensures only those countries are active=true.
    All other country-level rows are set to active=false.

    This is a no-op if the environment variable is unset or empty, or if
    the geographic_areas table does not exist yet.
    """
    raw = os.getenv("ACTIVE_COUNTRY_CODES", "").strip()
    if not raw:
        logger.info("ACTIVE_COUNTRY_CODES not set, skipping country sync")
        return

    codes = [c.strip().upper() for c in raw.split(",") if c.strip()]
    if not codes:
        logger.info("ACTIVE_COUNTRY_CODES is empty, skipping country sync")
        return

    logger.info(f"Syncing active countries to: {codes}")

    with _psycopg_connect(database_url) as connection:
        with connection.cursor() as cursor:
            # Check if geographic_areas table exists (migration may not have run yet)
            cursor.execute(
                "SELECT EXISTS ("
                "  SELECT 1 FROM information_schema.tables "
                "  WHERE table_name = 'geographic_areas'"
                ")"
            )
            exists = cursor.fetchone()
            if not exists or not exists[0]:
                logger.info("geographic_areas table does not exist yet, skipping")
                return

            # Deactivate all country-level rows
            cursor.execute(
                "UPDATE geographic_areas SET active = false " "WHERE level = 'country'"
            )

            # Activate only the configured ones
            cursor.execute(
                "UPDATE geographic_areas SET active = true "
                "WHERE level = 'country' AND code = ANY(%s)",
                (codes,),
            )

            # Log what we changed
            cursor.execute(
                "SELECT code, name, active FROM geographic_areas "
                "WHERE level = 'country' ORDER BY display_order"
            )
            rows = cursor.fetchall()
            for code, name, active in rows:
                status = "ACTIVE" if active else "inactive"
                logger.info(f"  Country {code} ({name}): {status}")

        connection.commit()

    logger.info("Country activation sync complete")


def _run_with_retry(func: Any, *args: Any) -> None:
    """Retry migration operations to wait for DB readiness."""

    func_name = getattr(func, "__name__", str(func))
    max_attempts = 10
    delay = 5.0
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            func(*args)
            logger.info(f"Operation {func_name} completed successfully")
            return
        except Exception as exc:  # pragma: no cover - best effort retry
            error_type = type(exc).__name__
            # SECURITY: Log error type and sanitized message
            # Avoid logging full exception which may contain credentials
            error_msg = str(exc)
            # Sanitize potential secrets from error messages
            safe_msg = _sanitize_error_message(error_msg)
            logger.warning(
                f"Attempt {attempt + 1}/{max_attempts} for {func_name} failed",
                extra={
                    "attempt": attempt + 1,
                    "max_attempts": max_attempts,
                    "error_type": error_type,
                    "error_message": safe_msg,
                    "function": func_name,
                },
            )
            last_error = exc
            if attempt < max_attempts - 1:
                logger.info(f"Retrying {func_name} in {delay:.1f} seconds...")
                time.sleep(delay)
                delay = min(delay * 1.5, 30.0)  # Cap at 30 seconds
    if last_error:
        raise last_error


def _sanitize_error_message(msg: str) -> str:
    """Remove potential secrets from error messages."""
    # Common patterns that might contain secrets
    import re

    # Redact anything that looks like a password in a connection string
    msg = re.sub(r"://[^:]+:[^@]+@", "://***:***@", msg)
    # Redact IAM tokens (long base64-like strings)
    msg = re.sub(r"password=[A-Za-z0-9+/=]{50,}", "password=***REDACTED***", msg)
    return msg


def _load_db_user_secret(secret_arn: str) -> tuple[str, str]:
    """Load database user credentials from Secrets Manager."""

    payload = _get_secret(secret_arn)
    username = payload.get("username") or payload.get("user")
    password = payload.get("password")
    if not username or not password:
        raise RuntimeError("Secret is missing database username or password")
    return str(username), str(password)


def _get_secret(secret_arn: str) -> dict[str, Any]:
    """Fetch a secret from AWS Secrets Manager."""

    if secret_arn in _SECRET_CACHE:
        return _SECRET_CACHE[secret_arn]

    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId=secret_arn)
    secret_str = response.get("SecretString")
    if not secret_str and response.get("SecretBinary"):
        secret_str = base64.b64decode(response["SecretBinary"]).decode("utf-8")

    if not secret_str:
        raise RuntimeError("Secret value is empty")

    secret_payload = json.loads(secret_str)
    _SECRET_CACHE[secret_arn] = secret_payload
    return secret_payload


def _validate_db_username(username: str) -> None:
    """Ensure proxy users match expected roles."""

    if username not in _ALLOWED_PROXY_USERS:
        raise RuntimeError(f"Unexpected database user: {username}")


def _get_or_create_seed_manager() -> str:
    """Get or create a test manager user for seed data.

    Creates a Cognito user 'test@lx-software.com' in the 'manager' group if it
    doesn't exist, and returns their sub (user ID) for use as manager_id
    in seed data.

    Returns:
        The Cognito user sub (UUID string).
    """
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
    if not user_pool_id:
        raise RuntimeError("COGNITO_USER_POOL_ID environment variable is required")

    client = boto3.client("cognito-idp")
    seed_email = "test@lx-software.com"
    # Generate a random password - user can reset via forgot password flow
    import secrets
    import string

    alphabet = string.ascii_letters + string.digits + "!@#$%"
    seed_password = "".join(secrets.choice(alphabet) for _ in range(16))

    # Check if user already exists
    try:
        response = client.list_users(
            UserPoolId=user_pool_id,
            Filter=f'email = "{seed_email}"',
            Limit=1,
        )
        users = response.get("Users", [])

        if users:
            # User exists, get their sub
            user = users[0]
            attributes = {
                attr["Name"]: attr["Value"] for attr in user.get("Attributes", [])
            }
            sub = attributes.get("sub")
            if sub:
                logger.info(f"Found existing seed manager user: {seed_email}")
                return sub
    except Exception as e:
        logger.warning(f"Error checking for existing user: {e}")

    # Create the user
    try:
        response = client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=seed_email,
            TemporaryPassword=seed_password,
            MessageAction="SUPPRESS",  # Don't send welcome email
            UserAttributes=[
                {"Name": "email", "Value": seed_email},
                {"Name": "email_verified", "Value": "true"},
            ],
        )

        # Set permanent password
        client.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username=seed_email,
            Password=seed_password,
            Permanent=True,
        )

        # Add to manager group
        try:
            client.admin_add_user_to_group(
                UserPoolId=user_pool_id,
                Username=seed_email,
                GroupName="manager",
            )
        except client.exceptions.ResourceNotFoundException:
            logger.warning("Manager group not found, skipping group assignment")

        # Get the sub from the created user
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
        # Race condition - user was created between check and create
        # Fetch the user's sub
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


def _escape_config(value: str) -> str:
    """Escape percent signs for configparser interpolation."""

    return value.replace("%", "%%")


def _psycopg_connect(database_url: str) -> psycopg.Connection:
    """Connect using keyword args to avoid DSN parsing issues."""

    try:
        url = make_url(database_url)
    except Exception:
        url = make_url(f"postgresql://{database_url}")

    connect_kwargs: dict[str, Any] = {
        "user": url.username,
        "password": url.password,
        "host": url.host,
        "port": url.port,
        "dbname": url.database,
    }
    sslmode = url.query.get("sslmode")
    if sslmode:
        connect_kwargs["sslmode"] = sslmode

    return psycopg.connect(**{k: v for k, v in connect_kwargs.items() if v is not None})


def _truthy(value: Any) -> bool:
    """Return True for common truthy values."""

    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "y"}
