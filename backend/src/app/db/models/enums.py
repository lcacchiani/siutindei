"""Enum definitions for database models."""

from __future__ import annotations

import enum


class PricingType(str, enum.Enum):
    """Supported pricing types for activities."""

    PER_CLASS = "per_class"
    PER_SESSIONS = "per_sessions"
    PER_HOUR = "per_hour"
    PER_DAY = "per_day"
    FREE = "free"


class ScheduleType(str, enum.Enum):
    """Supported schedule types for activities."""

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    DATE_SPECIFIC = "date_specific"


class TicketType(str, enum.Enum):
    """Discriminator for ticket types."""

    ACCESS_REQUEST = "access_request"
    ORGANIZATION_SUGGESTION = "organization_suggestion"


class TicketStatus(str, enum.Enum):
    """Lifecycle status for tickets."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
