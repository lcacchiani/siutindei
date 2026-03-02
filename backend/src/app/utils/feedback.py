"""Shared feedback-related utility helpers."""

from __future__ import annotations

import os

from app.api.admin_cognito import _adjust_user_feedback_stars
from app.services.aws_proxy import AwsProxyError
from app.utils.logging import get_logger

logger = get_logger(__name__)


def safe_adjust_feedback_stars(user_sub: str, delta: int) -> None:
    """Adjust feedback stars without failing the caller."""
    try:
        _adjust_user_feedback_stars(user_sub, delta)
    except (AwsProxyError, RuntimeError, ValueError) as exc:
        logger.error(
            "Failed to update feedback stars",
            extra={
                "user_sub": user_sub,
                "error_type": type(exc).__name__,
            },
        )
    except Exception as exc:
        # Safety-net logging so this helper never breaks request flows.
        logger.exception(
            "Unexpected feedback star update failure",
            extra={
                "user_sub": user_sub,
                "error_type": type(exc).__name__,
            },
        )


def feedback_stars_per_approval() -> int:
    """Return star increment configured for approvals."""
    raw = os.getenv("FEEDBACK_STARS_PER_APPROVAL", "1")
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        parsed = 1
    return max(0, parsed)
