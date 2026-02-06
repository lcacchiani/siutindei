# Database Schema

This document describes the PostgreSQL schema for the activities
backend. It is based on the SQLAlchemy models and Alembic migrations.

Alembic migrations live in `backend/db/alembic/versions/`.
Seed data lives in `backend/db/seed/seed_data.sql`.

## Extensions and enums

- Extension: `pgcrypto` (used by `gen_random_uuid()` defaults).
- Enum `pricing_type`: `per_class`, `per_month`, `per_sessions`.
- Enum `schedule_type`: `weekly`, `monthly`, `date_specific`.
- Enum `ticket_type`: `access_request`, `organization_suggestion`.
- Enum `ticket_status`: `pending`, `approved`, `rejected`.

## Table: organizations

Purpose: Organizations that provide activities.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `name` (text, required)
- `description` (text, optional)
- `manager_id` (text, required) — Cognito user sub of the organization manager
- `media_urls` (text[], default empty array)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)

Relationships:
- One organization has many locations.
- One organization has many activities.

## Table: locations

Purpose: Physical or logical locations for an organization.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `org_id` (UUID, FK -> organizations.id, cascade delete)
- `district` (text, required)
- `country` (text, required, default `'Hong Kong'`)
- `address` (text, optional)
- `lat` (numeric(9,6), optional)
- `lng` (numeric(9,6), optional)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)

Indexes:
- `locations_district_idx` on `district`
- `locations_org_idx` on `org_id`

## Table: activities

Purpose: Activities offered by organizations.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `org_id` (UUID, FK -> organizations.id, cascade delete)
- `name` (text, required)
- `description` (text, optional)
- `age_range` (int4range, required)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)

Indexes:
- `activities_age_gist` on `age_range` (GiST)
- `activities_org_idx` on `org_id`

## Table: activity_locations

Purpose: Join table for activities and locations.

Columns:
- `activity_id` (UUID, PK, FK -> activities.id, cascade delete)
- `location_id` (UUID, PK, FK -> locations.id, cascade delete)

Indexes:
- `activity_locations_location_idx` on `location_id`

## Table: activity_pricing

Purpose: Pricing for an activity at a location.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `activity_id` (UUID, FK -> activities.id, cascade delete)
- `location_id` (UUID, FK -> locations.id, cascade delete)
- `pricing_type` (enum `pricing_type`, required)
- `amount` (numeric(10,2), required)
- `currency` (text, default `HKD`)
- `sessions_count` (integer, optional)

Constraints:
- `pricing_sessions_count_check`:
  `sessions_count` is required and > 0 when
  `pricing_type = 'per_sessions'`.

Indexes:
- `activity_pricing_type_amount_idx` on `pricing_type`, `amount`
- `activity_pricing_location_idx` on `location_id`

## Table: activity_schedule

Purpose: Schedule entries for an activity at a location.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `activity_id` (UUID, FK -> activities.id, cascade delete)
- `location_id` (UUID, FK -> locations.id, cascade delete)
- `schedule_type` (enum `schedule_type`, required)
- `day_of_week_utc` (smallint, optional, 0=Sunday)
- `day_of_month` (smallint, optional, 1-31)
- `start_minutes_utc` (integer, optional, minutes after midnight)
- `end_minutes_utc` (integer, optional, minutes after midnight)
- `start_at_utc` (timestamptz, optional)
- `end_at_utc` (timestamptz, optional)
- `languages` (text[], default empty array)

Constraints:
- `schedule_day_of_week_range`: 0 to 6
- `schedule_day_of_month_range`: 1 to 31
- `schedule_start_minutes_range`: 0 to 1439
- `schedule_end_minutes_range`: 0 to 1439
- `schedule_minutes_order`: start < end when both minutes present
- `schedule_date_order`: start < end when both timestamps present
- `schedule_type_fields_check`:
  - `weekly`: day_of_week_utc + start/end minutes required
  - `monthly`: day_of_month + start/end minutes required
  - `date_specific`: start_at_utc + end_at_utc required

Indexes:
- `activity_schedule_type_weekly_idx` on
  `schedule_type`, `day_of_week_utc`, `start_minutes_utc`,
  `end_minutes_utc`
- `activity_schedule_type_monthly_idx` on
  `schedule_type`, `day_of_month`, `start_minutes_utc`,
  `end_minutes_utc`
- `activity_schedule_date_idx` on `start_at_utc`, `end_at_utc`
- `activity_schedule_languages_gin` on `languages` (GIN)

## Table: organizations (migration notes)

The following columns were added/renamed after the initial schema:

- `media_urls` was originally named `picture_urls` (renamed in migration 0006)
- `manager_id` was originally named `owner_id` (renamed in migration 0009)

## Table: tickets

Purpose: User-submitted tickets for admin review. The `ticket_type`
column determines the workflow; optional columns are populated as
needed by each type.

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `ticket_id` (text, unique, required) — progressive ID (prefix + 5 digits)
- `ticket_type` (enum `ticket_type`, required) — workflow discriminator
- `submitter_id` (text, required) — Cognito user sub
- `submitter_email` (text, required)
- `organization_name` (text, required)
- `message` (text, optional) — free-text from submitter
- `status` (enum `ticket_status`, default `pending`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)
- `reviewed_at` (timestamptz, optional)
- `reviewed_by` (text, optional) — Cognito user sub of reviewer
- `admin_notes` (text, optional)
- `description` (text, optional)
- `suggested_district` (text, optional)
- `suggested_address` (text, optional)
- `suggested_lat` (numeric, optional)
- `suggested_lng` (numeric, optional)
- `media_urls` (text[], default empty array)
- `created_organization_id` (UUID, FK -> organizations.id, optional)

Indexes:
- Unique on `ticket_id`
- Index on `ticket_type`
- Index on `status`
- Index on `submitter_id`
- Index on `created_at`
- Composite index on (`ticket_type`, `status`)

## Table: audit_log

Purpose: Automatic change tracking for all audited tables.
Populated via database triggers (see [`audit-logging.md`](audit-logging.md)).

Columns:
- `id` (UUID, PK, default `gen_random_uuid()`)
- `timestamp` (timestamptz, default `now()`)
- `table_name` (text, required)
- `record_id` (text, required) — primary key of the modified record
- `action` (text, required) — INSERT, UPDATE, or DELETE
- `user_id` (text, optional) — Cognito user sub from session context
- `request_id` (text, optional) — Lambda request ID
- `old_values` (jsonb, optional)
- `new_values` (jsonb, optional)
- `changed_fields` (text[], optional)
- `source` (text, optional) — 'trigger' or 'application'
- `ip_address` (text, optional)
- `user_agent` (text, optional)

Indexes:
- `audit_log_table_record_idx` on `table_name`, `record_id`
- `audit_log_timestamp_idx` on `timestamp`
- `audit_log_user_id_idx` on `user_id`
- `audit_log_action_idx` on `action`
