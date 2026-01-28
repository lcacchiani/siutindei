"""Cognito Verify Auth Challenge trigger.

This Lambda verifies the user's response to the custom authentication challenge.
"""

from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event, _context):
    """Verify the authentication challenge response."""

    request = event.get("request", {})
    expected = (request.get("privateChallengeParameters") or {}).get("answer")
    provided = request.get("challengeAnswer")
    response = event.setdefault("response", {})
    username = request.get("userAttributes", {}).get("email", "unknown")

    is_correct = bool(expected) and provided == expected
    response["answerCorrect"] = is_correct

    if is_correct:
        logger.info(f"Challenge verified successfully for {username}")
    else:
        logger.warning(f"Challenge verification failed for {username}")

    return event
