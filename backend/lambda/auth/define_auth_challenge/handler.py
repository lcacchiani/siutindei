"""Cognito Define Auth Challenge trigger.

This Lambda determines whether to issue tokens, fail authentication,
or continue with a custom challenge based on the session history.
"""

import os
from typing import Any

from app.utils.logging import configure_logging, get_logger, mask_email

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Define the authentication challenge flow."""

    max_attempts = int(os.getenv("MAX_CHALLENGE_ATTEMPTS", "3"))
    session = event.get("request", {}).get("session", []) or []
    response = event.setdefault("response", {})
    username = (
        event.get("request", {}).get("userAttributes", {}).get("email", "unknown")
    )

    masked_username = mask_email(str(username))

    logger.debug(
        f"Define auth challenge for {masked_username}",
        extra={"session_length": len(session), "max_attempts": max_attempts},
    )

    if session:
        last = session[-1]
        if last.get("challengeName") == "CUSTOM_CHALLENGE" and last.get(
            "challengeResult"
        ):
            logger.info(f"Auth successful for {masked_username}")
            response["issueTokens"] = True
            response["failAuthentication"] = False
            return event

        if len(session) >= max_attempts:
            logger.warning(f"Max auth attempts reached for {masked_username}")
            response["issueTokens"] = False
            response["failAuthentication"] = True
            return event

    logger.debug(f"Issuing custom challenge for {masked_username}")
    response["issueTokens"] = False
    response["failAuthentication"] = False
    response["challengeName"] = "CUSTOM_CHALLENGE"
    return event
