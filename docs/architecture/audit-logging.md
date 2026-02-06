# Database Audit Logging

This document describes the audit logging implementation for tracking all data changes in the database.

## Overview

The system uses a **hybrid audit logging approach** combining:

1. **Database Triggers** - Automatically capture all INSERT, UPDATE, DELETE operations
2. **Application-Level Context** - Enriches trigger logs with user identity and request ID

This ensures:
- All changes are captured, even direct database modifications
- Business context (who, why) is preserved with each change
- Compliance with audit requirements

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Lambda Handler                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  set_audit_context(session, user_id, request_id)        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Database Operations (CRUD)                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           Audit Trigger Function                         │    │
│  │  - Reads app.current_user_id from session               │    │
│  │  - Reads app.current_request_id from session            │    │
│  │  - Captures old/new values as JSONB                     │    │
│  │  - Detects changed fields                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    audit_log table                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### audit_log Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `timestamp` | TIMESTAMPTZ | When the change occurred |
| `table_name` | TEXT | Name of the modified table |
| `record_id` | TEXT | Primary key of the modified record |
| `action` | TEXT | INSERT, UPDATE, or DELETE |
| `user_id` | TEXT | Cognito user sub who made the change |
| `request_id` | TEXT | Lambda request ID for log correlation |
| `old_values` | JSONB | Previous values (UPDATE/DELETE) |
| `new_values` | JSONB | New values (INSERT/UPDATE) |
| `changed_fields` | TEXT[] | List of fields that changed (UPDATE) |
| `source` | TEXT | 'trigger' or 'application' |
| `ip_address` | TEXT | Client IP (if available) |
| `user_agent` | TEXT | Client user agent (if available) |

### Indexes

- `audit_log_table_record_idx` - Query history for a specific record
- `audit_log_timestamp_idx` - Query by time range
- `audit_log_user_id_idx` - Query user activity
- `audit_log_action_idx` - Filter by action type

## Usage

### Automatic Trigger-Based Auditing

All CRUD operations are automatically audited via database triggers. To include user context:

```python
from sqlalchemy.orm import Session
from app.db.engine import get_engine
from app.db.audit import set_audit_context

with Session(get_engine()) as session:
    # Set context for trigger-based auditing
    set_audit_context(
        session,
        user_id="cognito-user-sub",
        request_id="lambda-request-id"
    )

    # All changes in this transaction will be audited with this context
    repo = OrganizationRepository(session)
    org = repo.get_by_id(org_id)
    org.name = "New Name"
    repo.update(org)
    session.commit()
```

### Application-Level Auditing

For custom actions or additional metadata:

```python
from app.db.audit import AuditService, serialize_for_audit

with Session(get_engine()) as session:
    audit = AuditService(
        session,
        user_id="cognito-user-sub",
        request_id="lambda-request-id",
        ip_address="192.168.1.1",
    )

    # Log a custom action
    audit.log_custom(
        table_name="organization_access_requests",
        record_id=request.id,
        action="APPROVE",
        old_values={"status": "pending"},
        new_values={"status": "approved"},
    )

    session.commit()
```

### Querying Audit Logs

```python
from app.db.audit import AuditLogRepository
from datetime import datetime, timedelta

with Session(get_engine()) as session:
    repo = AuditLogRepository(session)

    # Get history for a specific record
    history = repo.get_record_history("organizations", org_id)

    # Get user activity
    activity = repo.get_user_activity(user_sub, limit=50)

    # Get recent changes to a table
    recent = repo.get_table_activity(
        "activities",
        since=datetime.now() - timedelta(days=7),
        action="DELETE"
    )
```

## Audited Tables

The following tables have audit triggers:

- `organizations`
- `locations`
- `activities`
- `activity_locations`
- `activity_pricing`
- `activity_schedule`
- `organization_access_requests`

## Performance Considerations

1. **Trigger Overhead**: Minimal (~1-2ms per operation)
2. **Storage Growth**: Monitor `audit_log` table size
3. **Query Performance**: Use indexes for efficient queries

### Recommended Retention Policy

Consider implementing a retention policy to manage audit log growth:

```sql
-- Example: Archive logs older than 1 year
DELETE FROM audit_log
WHERE timestamp < NOW() - INTERVAL '1 year';
```

## Security

- **No PII in logs**: User IDs are Cognito subs, not emails
- **Request correlation**: Use `request_id` to correlate with CloudWatch logs
- **Access control**: Only admin users can query audit logs via API
- **Tamper evidence**: Trigger-based logging cannot be bypassed by application code

## Compliance

This implementation supports:

- **SOC 2**: Change tracking and accountability
- **GDPR**: Data processing audit trail
- **Internal policies**: Who changed what, when

## Admin API Endpoint

The audit logs can be queried via the admin API:

### GET /v1/admin/audit-logs

List audit log entries with optional filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | string | Filter by table name |
| `record_id` | string | Filter by record ID (requires `table`) |
| `user_id` | string | Filter by Cognito user sub |
| `action` | string | Filter by action: INSERT, UPDATE, DELETE |
| `since` | string | ISO 8601 timestamp to filter from |
| `limit` | integer | Max results (1-200, default 50) |
| `cursor` | string | Pagination cursor |

**Example Requests:**

```bash
# Get recent audit logs
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/audit-logs"

# Get history for a specific organization
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/audit-logs?table=organizations&record_id=123e4567-e89b-12d3-a456-426614174000"

# Get a user's activity
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/audit-logs?user_id=abc123-def456"

# Get recent deletes in the last 7 days
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/v1/admin/audit-logs?action=DELETE&since=2024-01-01T00:00:00Z"
```

**Response:**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-15T10:30:00Z",
      "table_name": "organizations",
      "record_id": "123e4567-e89b-12d3-a456-426614174000",
      "action": "UPDATE",
      "user_id": "abc123-def456",
      "request_id": "req-789",
      "old_values": {"name": "Old Name"},
      "new_values": {"name": "New Name"},
      "changed_fields": ["name"],
      "source": "trigger"
    }
  ],
  "next_cursor": "eyJpZCI6Ii..."
}
```

### GET /v1/admin/audit-logs/{id}

Get a single audit log entry by ID.

**Note:** Sensitive fields (password, secret, token, api_key) are automatically redacted from `old_values` and `new_values`.

---

## Migration

The audit logging is added via Alembic migration `0010_add_audit_logging.py`.

To apply:
```bash
cd backend/db
alembic upgrade head
```

To rollback:
```bash
alembic downgrade 0009_rename_owner_to_manager
```
