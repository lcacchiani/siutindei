"""Cognito Pre Sign-up trigger.

This Lambda handles pre-signup validation and auto-confirmation.
"""

from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event, _context):
    """Handle pre-signup trigger."""

    request = event.get("request", {})
    response = event.setdefault("response", {})
    user_attributes = request.get("userAttributes", {})
    email = user_attributes.get("email", "unknown")

    logger.info(f"Pre-signup for {email}")

    # Auto-confirm the user (we verify via custom auth challenge)
    response["autoConfirmUser"] = True
    response["autoVerifyEmail"] = True

    return event
