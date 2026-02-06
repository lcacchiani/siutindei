# AWS Messaging Architecture

## Overview

Manager requests are processed asynchronously using SNS + SQS messaging. This provides reliable, decoupled processing with automatic retries and dead letter queue support.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MANAGER REQUEST FLOW                               │
│                                                                             │
│  User submits ──▶ API Lambda ──▶ SNS Topic ──▶ SQS Queue ──▶ Processor     │
│   request              │              │              │         Lambda       │
│                        │              │              │            │         │
│                   (validates,    (fan-out)     (reliable      (stores in   │
│                   returns 202)                  delivery)      DB, sends   │
│                                                    │           email)      │
│                                                    │                       │
│                                                    ▼                       │
│                                               Dead Letter                  │
│                                                 Queue                      │
│                                            (failed messages)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### SNS Topic: `lxsoftware-siutindei-manager-request-events`

- Receives manager request events from the API
- Fans out to subscribed SQS queue
- Message attributes enable future filtering

### SQS Queue: `lxsoftware-siutindei-manager-request-queue`

- Subscribes to SNS topic
- 60 second visibility timeout (6x Lambda timeout)
- 3 retry attempts before DLQ
- SQS-managed encryption

### Dead Letter Queue: `lxsoftware-siutindei-manager-request-dlq`

- Receives messages that fail processing 3 times
- 14 day retention for debugging
- CloudWatch alarm triggers when messages arrive

### Processor Lambda: `ManagerRequestProcessor`

- Triggered by SQS messages
- Stores request in PostgreSQL database
- Sends email notification via SES
- Idempotent via `ticket_id` check

## Message Format

```json
{
  "event_type": "manager_request.submitted",
  "ticket_id": "R00001",
  "requester_id": "cognito-user-sub-uuid",
  "requester_email": "user@example.com",
  "organization_name": "My Organization",
  "request_message": "Optional message from user"
}
```

## API Behavior

The user-facing API endpoints for access requests are at
`/v1/user/access-request` (GET, POST). Admin review endpoints are at
`/v1/admin/access-requests`. For full endpoint details (parameters,
request/response schemas), see the OpenAPI spec:
[`docs/api/admin.yaml`](../api/admin.yaml).

**Processing flow:**
1. User POSTs a request → API validates, generates ticket ID, publishes to SNS
2. Returns `202 Accepted` with ticket ID
3. SQS delivers message to processor Lambda
4. Processor stores in DB and sends email notification

## Error Handling

| Scenario | Behavior |
|----------|----------|
| SNS publish fails | API returns 500, user can retry |
| Processor fails | SQS retries up to 3 times |
| All retries fail | Message moves to DLQ, alarm triggers |
| Email send fails | Logged but doesn't fail processing |

## Idempotency

The processor checks if a request with the same `ticket_id` already exists before inserting. This handles SQS's at-least-once delivery guarantee.

## Files

| File | Description |
|------|-------------|
| `backend/infrastructure/lib/api-stack.ts` | CDK infrastructure |
| `backend/src/app/api/admin.py` | API handler with SNS publish |
| `backend/lambda/manager_request_processor/handler.py` | SQS processor |
| `backend/src/app/db/repositories/access_request.py` | Repository with `find_by_ticket_id` |

## Environment Variables

### API Lambda

| Variable | Description |
|----------|-------------|
| `MANAGER_REQUEST_TOPIC_ARN` | SNS topic ARN (required) |

### Processor Lambda

| Variable | Description |
|----------|-------------|
| `DATABASE_SECRET_ARN` | Database credentials secret |
| `DATABASE_PROXY_ENDPOINT` | RDS Proxy endpoint |
| `SUPPORT_EMAIL` | Email to receive notifications |
| `SES_SENDER_EMAIL` | Verified SES sender address |

## Stack Outputs

| Output | Description |
|--------|-------------|
| `ManagerRequestTopicArn` | SNS topic ARN |
| `ManagerRequestQueueUrl` | SQS queue URL |
| `ManagerRequestDLQUrl` | Dead letter queue URL |

## Monitoring

- **DLQ Alarm**: Triggers when messages land in DLQ
- **CloudWatch Logs**: Both API and processor Lambda log to CloudWatch
- **X-Ray**: Tracing enabled for request flow visibility
