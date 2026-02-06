# Organization Suggestions

This document describes the organization suggestion feature that allows public users to suggest new places for admin review.

## Overview

Public logged-in users can suggest new organizations (places) without becoming managers. This is useful for:
- Users discovering new venues they want to share
- Community-driven content expansion
- Quality control through admin review

## User Flow

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│   User submits  │────▶│  SNS Topic  │────▶│  SQS Queue  │
│   suggestion    │     │             │     │             │
└─────────────────┘     └─────────────┘     └──────┬──────┘
                                                    │
                                                    ▼
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│  Admin reviews  │◀────│  Database   │◀────│   Lambda    │
│  in console     │     │             │     │  Processor  │
└────────┬────────┘     └─────────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Approve/Reject  │────▶│ Email sent  │
│                 │     │ to user     │
└─────────────────┘     └─────────────┘
```

## API Endpoints

The organization suggestion feature exposes endpoints under two route
groups:

- **User endpoints** (`/v1/user/organization-suggestion`): Any
  authenticated user can view their suggestion history and submit new
  suggestions.
- **Admin endpoints** (`/v1/admin/organization-suggestions`): Admins
  can list all suggestions and approve/reject them.

For full endpoint details (parameters, request/response schemas,
authentication requirements), see the OpenAPI spec:
[`docs/api/admin.yaml`](../api/admin.yaml) — search for
`/v1/user/organization-suggestion` and
`/v1/admin/organization-suggestions`.

## Database Schema

### organization_suggestions Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `ticket_id` | TEXT | Unique ticket ID (S00001) |
| `suggester_id` | TEXT | Cognito user sub |
| `suggester_email` | TEXT | For notifications |
| `organization_name` | TEXT | Suggested name |
| `description` | TEXT | Description of the place |
| `suggested_district` | TEXT | Location district |
| `suggested_address` | TEXT | Full address |
| `suggested_lat` | NUMERIC | Latitude |
| `suggested_lng` | NUMERIC | Longitude |
| `media_urls` | TEXT[] | Uploaded media files |
| `additional_notes` | TEXT | Extra info from user |
| `status` | ENUM | pending/approved/rejected |
| `created_at` | TIMESTAMPTZ | Submission time |
| `reviewed_at` | TIMESTAMPTZ | Review time |
| `reviewed_by` | TEXT | Admin who reviewed |
| `admin_notes` | TEXT | Admin's notes |
| `created_organization_id` | UUID | FK to created org |

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUGGESTION_TOPIC_ARN` | SNS topic for suggestions (or uses `MANAGER_REQUEST_TOPIC_ARN`) |
| `SES_SENDER_EMAIL` | Email sender for notifications |

## Differences from Access Requests

| Feature | Access Request | Organization Suggestion |
|---------|----------------|------------------------|
| **Purpose** | User wants to manage an org | User informs about a new place |
| **User becomes manager** | Yes | No |
| **Ticket prefix** | R (R00001) | S (S00001) |
| **Creates org on approval** | Optional | Optional |
| **Manager assignment** | User becomes manager | Admin becomes temporary manager |

## Migration

Apply the migration:
```bash
cd backend/db
alembic upgrade head
```

Rollback:
```bash
alembic downgrade 0010_add_audit_logging
```
