"""SQLAlchemy models for activities data."""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal
from typing import List
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import CheckConstraint
from sqlalchemy import ForeignKey
from sqlalchemy import Numeric
from sqlalchemy import Integer
from sqlalchemy import SmallInteger
from sqlalchemy import Text
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import INT4RANGE
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base


class PricingType(str, enum.Enum):
    """Supported pricing types for activities."""

    PER_CLASS = "per_class"
    PER_MONTH = "per_month"
    PER_SESSIONS = "per_sessions"


class ScheduleType(str, enum.Enum):
    """Supported schedule types for activities."""

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    DATE_SPECIFIC = "date_specific"


class AccessRequestStatus(str, enum.Enum):
    """Status for organization access requests (legacy)."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SuggestionStatus(str, enum.Enum):
    """Status for organization suggestions (legacy)."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TicketType(str, enum.Enum):
    """Type of ticket in the unified tickets table."""

    ACCESS_REQUEST = "access_request"
    ORGANIZATION_SUGGESTION = "organization_suggestion"


class TicketStatus(str, enum.Enum):
    """Status for unified tickets."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Organization(Base):
    """Organization that provides activities."""

    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(Text(), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    manager_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Cognito user sub (subject) identifier of the organization manager",
    )
    media_urls: Mapped[List[str]] = mapped_column(
        ARRAY(Text()),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    locations: Mapped[List["Location"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    activities: Mapped[List["Activity"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )


class Location(Base):
    """Location for an organization."""

    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    org_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    district: Mapped[str] = mapped_column(Text(), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    lng: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    organization: Mapped["Organization"] = relationship(back_populates="locations")
    activity_pricing: Mapped[List["ActivityPricing"]] = relationship(
        back_populates="location",
        cascade="all, delete-orphan",
    )
    activity_schedules: Mapped[List["ActivitySchedule"]] = relationship(
        back_populates="location",
        cascade="all, delete-orphan",
    )


class Activity(Base):
    """Activity offered by an organization."""

    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    org_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text(), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    age_range: Mapped[object] = mapped_column(INT4RANGE(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    organization: Mapped["Organization"] = relationship(back_populates="activities")
    locations: Mapped[List["ActivityLocation"]] = relationship(
        back_populates="activity",
        cascade="all, delete-orphan",
    )
    pricing: Mapped[List["ActivityPricing"]] = relationship(
        back_populates="activity",
        cascade="all, delete-orphan",
    )
    schedules: Mapped[List["ActivitySchedule"]] = relationship(
        back_populates="activity",
        cascade="all, delete-orphan",
    )


class ActivityLocation(Base):
    """Association between activities and locations."""

    __tablename__ = "activity_locations"

    activity_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activities.id", ondelete="CASCADE"),
        primary_key=True,
    )
    location_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="CASCADE"),
        primary_key=True,
    )

    activity: Mapped["Activity"] = relationship(back_populates="locations")
    location: Mapped["Location"] = relationship()


class ActivityPricing(Base):
    """Pricing for an activity at a specific location."""

    __tablename__ = "activity_pricing"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    activity_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activities.id", ondelete="CASCADE"),
        nullable=False,
    )
    location_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
    )
    pricing_type: Mapped[PricingType] = mapped_column(
        sa.Enum(
            PricingType,
            name="pricing_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(Text(), nullable=False, server_default="HKD")
    sessions_count: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(pricing_type <> 'per_sessions') OR "
            "(sessions_count IS NOT NULL AND sessions_count > 0)",
            name="pricing_sessions_count_check",
        ),
    )

    activity: Mapped["Activity"] = relationship(back_populates="pricing")
    location: Mapped["Location"] = relationship(back_populates="activity_pricing")


class ActivitySchedule(Base):
    """Schedule entry for an activity at a location."""

    __tablename__ = "activity_schedule"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    activity_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activities.id", ondelete="CASCADE"),
        nullable=False,
    )
    location_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
    )
    schedule_type: Mapped[ScheduleType] = mapped_column(
        sa.Enum(
            ScheduleType,
            name="schedule_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    day_of_week_utc: Mapped[Optional[int]] = mapped_column(
        SmallInteger(), nullable=True
    )
    day_of_month: Mapped[Optional[int]] = mapped_column(SmallInteger(), nullable=True)
    start_minutes_utc: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)
    end_minutes_utc: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)
    start_at_utc: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    end_at_utc: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    languages: Mapped[List[str]] = mapped_column(
        ARRAY(Text()),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )

    __table_args__ = (
        CheckConstraint(
            "day_of_week_utc BETWEEN 0 AND 6", name="schedule_day_of_week_range"
        ),
        CheckConstraint(
            "day_of_month BETWEEN 1 AND 31", name="schedule_day_of_month_range"
        ),
        CheckConstraint(
            "start_minutes_utc BETWEEN 0 AND 1439", name="schedule_start_minutes_range"
        ),
        CheckConstraint(
            "end_minutes_utc BETWEEN 0 AND 1439", name="schedule_end_minutes_range"
        ),
        CheckConstraint(
            "start_minutes_utc IS NULL OR end_minutes_utc IS NULL OR "
            "start_minutes_utc < end_minutes_utc",
            name="schedule_minutes_order",
        ),
        CheckConstraint(
            "start_at_utc IS NULL OR end_at_utc IS NULL OR start_at_utc < end_at_utc",
            name="schedule_date_order",
        ),
        CheckConstraint(
            "("
            "schedule_type = 'weekly' AND "
            "day_of_week_utc IS NOT NULL AND "
            "start_minutes_utc IS NOT NULL AND "
            "end_minutes_utc IS NOT NULL AND "
            "day_of_month IS NULL AND "
            "start_at_utc IS NULL AND "
            "end_at_utc IS NULL"
            ") OR ("
            "schedule_type = 'monthly' AND "
            "day_of_month IS NOT NULL AND "
            "start_minutes_utc IS NOT NULL AND "
            "end_minutes_utc IS NOT NULL AND "
            "day_of_week_utc IS NULL AND "
            "start_at_utc IS NULL AND "
            "end_at_utc IS NULL"
            ") OR ("
            "schedule_type = 'date_specific' AND "
            "start_at_utc IS NOT NULL AND "
            "end_at_utc IS NOT NULL AND "
            "day_of_week_utc IS NULL AND "
            "day_of_month IS NULL AND "
            "start_minutes_utc IS NULL AND "
            "end_minutes_utc IS NULL"
            ")",
            name="schedule_type_fields_check",
        ),
    )

    activity: Mapped["Activity"] = relationship(back_populates="schedules")
    location: Mapped["Location"] = relationship(back_populates="activity_schedules")


class OrganizationAccessRequest(Base):
    """Request from a manager to be added to an organization."""

    __tablename__ = "organization_access_requests"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    ticket_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        unique=True,
        comment="Unique progressive ticket ID for tracking (format: R + 5 digits)",
    )
    requester_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Cognito user sub (subject) identifier of the requesting user",
    )
    requester_email: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Email address of the requester",
    )
    organization_name: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Name of the organization the user wants to join/create",
    )
    request_message: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Optional message from the requester",
    )
    status: Mapped[AccessRequestStatus] = mapped_column(
        sa.Enum(
            AccessRequestStatus,
            name="access_request_status",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        server_default=text("'pending'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the request was reviewed",
    )
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Cognito user sub of the admin who reviewed the request",
    )


class AuditLog(Base):
    """Audit log entry for tracking data changes.

    This table stores both:
    - Trigger-generated entries (source='trigger') for all database changes
    - Application-generated entries (source='application') with full context

    The hybrid approach ensures:
    - All changes are captured (via triggers)
    - Business context is preserved (via application logging)
    """

    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    table_name: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Name of the table that was modified",
    )
    record_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Primary key of the modified record",
    )
    action: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="INSERT, UPDATE, or DELETE",
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Cognito user sub who made the change",
    )
    request_id: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Lambda request ID for correlation",
    )
    old_values: Mapped[Optional[dict]] = mapped_column(
        sa.dialects.postgresql.JSONB(),
        nullable=True,
        comment="Previous values (for UPDATE/DELETE)",
    )
    new_values: Mapped[Optional[dict]] = mapped_column(
        sa.dialects.postgresql.JSONB(),
        nullable=True,
        comment="New values (for INSERT/UPDATE)",
    )
    changed_fields: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(Text()),
        nullable=True,
        comment="List of fields that changed (for UPDATE)",
    )
    source: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        server_default=text("'trigger'"),
        comment="Source of the audit entry: trigger or application",
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Client IP address if available",
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Client user agent if available",
    )


class OrganizationSuggestion(Base):
    """Suggestion for a new organization from a public user.

    Unlike access requests, users submitting suggestions don't become managers.
    They simply inform admins about new places that could be added.
    """

    __tablename__ = "organization_suggestions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    ticket_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        unique=True,
        comment="Unique progressive ticket ID (format: S + 5 digits)",
    )
    suggester_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Cognito user sub of the person suggesting",
    )
    suggester_email: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Email of the suggester for notifications",
    )
    organization_name: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Suggested name for the organization",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Description of the organization/place",
    )
    suggested_district: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="District where the place is located",
    )
    suggested_address: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Full address of the place",
    )
    suggested_lat: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(9, 6),
        nullable=True,
        comment="Latitude coordinate",
    )
    suggested_lng: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(9, 6),
        nullable=True,
        comment="Longitude coordinate",
    )
    media_urls: Mapped[List[str]] = mapped_column(
        ARRAY(Text()),
        nullable=False,
        server_default=text("'{}'::text[]"),
        comment="URLs of uploaded media files",
    )
    additional_notes: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Any additional information from the suggester",
    )
    status: Mapped[SuggestionStatus] = mapped_column(
        sa.Enum(
            SuggestionStatus,
            name="suggestion_status",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        server_default=text("'pending'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the suggestion was reviewed",
    )
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Cognito user sub of the admin who reviewed",
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Notes from the reviewing admin",
    )
    created_organization_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        comment="ID of organization created from this suggestion (if approved)",
    )

    # Relationship to the created organization (if approved)
    created_organization: Mapped[Optional["Organization"]] = relationship()


class Ticket(Base):
    """Unified ticket for access requests and organization suggestions.

    This table replaces both organization_access_requests and
    organization_suggestions. Common fields are shared; type-specific
    fields are nullable columns.

    ticket_type discriminates between:
    - access_request: user wants to manage an existing/new org (prefix R)
    - organization_suggestion: user informs about a new place (prefix S)
    """

    __tablename__ = "tickets"

    # --- Common fields ---
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    ticket_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        unique=True,
        comment="Unique progressive ticket ID (R00001 or S00001)",
    )
    ticket_type: Mapped[TicketType] = mapped_column(
        sa.Enum(
            TicketType,
            name="ticket_type",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        comment="Type of ticket: access_request or organization_suggestion",
    )
    submitter_id: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Cognito user sub of the person who submitted",
    )
    submitter_email: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Email of the submitter for notifications",
    )
    organization_name: Mapped[str] = mapped_column(
        Text(),
        nullable=False,
        comment="Organization name (requested or suggested)",
    )
    message: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Free-text from submitter (request_message or additional_notes)",
    )
    status: Mapped[TicketStatus] = mapped_column(
        sa.Enum(
            TicketStatus,
            name="ticket_status",
            values_callable=lambda x: [e.value for e in x],
            create_type=False,
        ),
        nullable=False,
        server_default=text("'pending'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the ticket was reviewed",
    )
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Cognito user sub of the admin who reviewed",
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Notes from the reviewing admin",
    )

    # --- Suggestion-specific fields (nullable for access_request) ---
    description: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Description of the suggested place",
    )
    suggested_district: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="District where the suggested place is located",
    )
    suggested_address: Mapped[Optional[str]] = mapped_column(
        Text(),
        nullable=True,
        comment="Full address of the suggested place",
    )
    suggested_lat: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(9, 6),
        nullable=True,
        comment="Latitude coordinate",
    )
    suggested_lng: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(9, 6),
        nullable=True,
        comment="Longitude coordinate",
    )
    media_urls: Mapped[List[str]] = mapped_column(
        ARRAY(Text()),
        nullable=False,
        server_default=text("'{}'::text[]"),
        comment="URLs of uploaded media files",
    )
    created_organization_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        comment="ID of organization created/assigned on approval",
    )

    # Relationship to the created organization
    created_organization: Mapped[Optional["Organization"]] = relationship(
        foreign_keys=[created_organization_id],
    )
