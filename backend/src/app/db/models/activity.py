"""Activity-related models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, INT4RANGE, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from app.db.base import Base
from app.db.models.enums import PricingType, ScheduleType


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
    category_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_categories.id", ondelete="RESTRICT"),
        nullable=False,
        comment="FK to activity_categories",
    )
    name: Mapped[str] = mapped_column(Text(), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    name_translations: Mapped[dict[str, str]] = mapped_column(
        sa.dialects.postgresql.JSONB(),
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
        comment="Language map for non-English name translations",
    )
    description_translations: Mapped[dict[str, str]] = mapped_column(
        sa.dialects.postgresql.JSONB(),
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
        comment="Language map for non-English description translations",
    )
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
    category: Mapped["ActivityCategory"] = relationship(back_populates="activities")
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
    free_trial_class_offered: Mapped[bool] = mapped_column(
        sa.Boolean(),
        nullable=False,
        default=False,
        server_default=text("false"),
    )

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
            "start_minutes_utc != end_minutes_utc",
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
