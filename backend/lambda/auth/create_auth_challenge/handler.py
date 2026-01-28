"""Cognito Create Auth Challenge trigger.

This Lambda creates a custom authentication challenge by generating
an OTP code and sending it via email.
"""

from app.auth.passwordless import build_challenge, send_sign_in_email
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event, _context):
    """Create a custom authentication challenge."""

    request = event.get("request", {})
    response = event.setdefault("response", {})

    if request.get("challengeName") != "CUSTOM_CHALLENGE":
        return event

    user_attributes = request.get("userAttributes") or {}
    email = user_attributes.get("email", "")
    challenge = build_challenge()
    code = challenge["code"]

    logger.info(f"Creating auth challenge for {email}")

    if email:
        try:
            send_sign_in_email(email, code)
            logger.debug(f"Challenge email sent to {email}")
        except Exception as exc:
            logger.error(f"Failed to send challenge email: {exc}")
            raise

    response["publicChallengeParameters"] = {"email": email}
    response["privateChallengeParameters"] = {"answer": code}
    response["challengeMetadata"] = "EMAIL_OTP"
    return event
