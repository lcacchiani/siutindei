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

### User Endpoints

#### GET /v1/user/organization-suggestion

Get the current user's suggestion history.

**Response:**
```json
{
  "has_pending_suggestion": true,
  "suggestions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "ticket_id": "S00001",
      "organization_name": "Sunny Kids Academy",
      "description": "Great art classes for children",
      "suggested_district": "Central",
      "suggested_address": "123 Main St",
      "suggested_lat": 22.2796,
      "suggested_lng": 114.1732,
      "media_urls": ["https://images.example.com/org/photo1.jpg"],
      "additional_notes": "Open on weekends too",
      "status": "pending",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### POST /v1/user/organization-suggestion

Submit a new organization suggestion.

**Request Body:**
```json
{
  "organization_name": "Sunny Kids Academy",
  "description": "Great art classes for children aged 3-12",
  "suggested_district": "Central",
  "suggested_address": "123 Main St, Central",
  "suggested_lat": 22.2796,
  "suggested_lng": 114.1732,
  "media_urls": ["https://images.example.com/org/photo1.jpg"],
  "additional_notes": "They also offer weekend classes"
}
```

**Response (202 Accepted):**
```json
{
  "message": "Your suggestion has been submitted and is being processed",
  "ticket_id": "S00001"
}
```

### Admin Endpoints

#### GET /v1/admin/organization-suggestions

List all suggestions for admin review.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: pending, approved, rejected |
| `limit` | integer | Max results (1-200, default 50) |
| `cursor` | string | Pagination cursor |

**Response:**
```json
{
  "items": [...],
  "next_cursor": "eyJpZCI6...",
  "pending_count": 5
}
```

#### PUT /v1/admin/organization-suggestions/{id}

Approve or reject a suggestion.

**Request Body:**
```json
{
  "action": "approve",
  "admin_notes": "Great suggestion! Adding to the platform.",
  "create_organization": true
}
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `action` | string | Required. "approve" or "reject" |
| `admin_notes` | string | Optional. Notes for the suggester |
| `create_organization` | boolean | If true, creates an org from the suggestion |

**Response:**
```json
{
  "message": "Suggestion has been approved",
  "suggestion": {...},
  "organization": {...}
}
```

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
| `media_urls` | TEXT[] | Uploaded pictures |
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
