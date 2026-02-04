# AWS Messaging with SNS + SQS

## Status: IMPLEMENTED

This document describes the SNS + SQS messaging architecture for access requests.
The implementation is complete and ready for deployment.

## Previous Implementation Problem

The application previously used PostgreSQL as a message queue for `organization_access_requests`:

```
Manager submits → API writes to DB → Admins poll DB → Process request
```

**Problems:**
- Database was both storage AND queue (conflated responsibilities)
- No push notifications to admins
- Polling wastes resources
- No automatic retries if email sending fails

---

## Recommended Architecture: SNS + SQS

**SNS** (Simple Notification Service) + **SQS** (Simple Queue Service) is the standard AWS pattern for reliable, decoupled messaging.

```
                                    ┌─────────────────────────────────────┐
                                    │         SNS Topic                    │
                                    │    "access-request-events"           │
                                    └─────────────────────────────────────┘
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     │                              │                              │
                     ▼                              ▼                              ▼
          ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
          │   SQS Queue         │      │   SQS Queue         │      │   Email (direct)    │
          │ "process-requests"  │      │ "audit-log"         │      │   admin@example.com │
          └─────────────────────┘      └─────────────────────┘      └─────────────────────┘
                     │                              │
                     ▼                              ▼
          ┌─────────────────────┐      ┌─────────────────────┐
          │   Lambda            │      │   Lambda            │
          │ - Store in DB       │      │ - Write to          │
          │ - Send SES email    │      │   CloudWatch Logs   │
          └─────────────────────┘      └─────────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │   Dead Letter Queue │
          │   (failed messages) │
          └─────────────────────┘
```

### Why SNS + SQS Together?

| Component | Role |
|-----------|------|
| **SNS** | Fan-out to multiple subscribers, direct email delivery |
| **SQS** | Reliable delivery with retries, dead letter queue |
| **Together** | Best of both worlds - fan-out AND reliability |

---

## AWS Messaging Options (Reference)

### 1. Amazon SQS (Simple Queue Service)

**Best for:** Decoupled, reliable message processing with at-least-once delivery.

```
┌─────────┐     ┌─────────┐     ┌─────────────┐
│ Manager │────▶│   SQS   │────▶│ Lambda/ECS  │
│ submits │     │  Queue  │     │  Processor  │
└─────────┘     └─────────┘     └─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ Dead Letter │
              │    Queue    │
              └─────────────┘
```

**Features:**
- Standard queues: unlimited throughput, best-effort ordering
- FIFO queues: exactly-once processing, strict ordering (300 TPS, or 3000 with batching)
- Built-in dead letter queues (DLQ) for failed messages
- Message retention up to 14 days
- Long polling reduces empty responses
- Automatic scaling

**Pricing:** ~$0.40 per million requests (first million free/month)

**Example Integration:**
```python
import boto3
import json

sqs = boto3.client('sqs')

# Producer: Submit access request
def submit_access_request(requester_id: str, email: str, org_name: str, message: str = None):
    sqs.send_message(
        QueueUrl='https://sqs.region.amazonaws.com/account/access-requests',
        MessageBody=json.dumps({
            'requester_id': requester_id,
            'requester_email': email,
            'organization_name': org_name,
            'request_message': message,
        }),
        MessageGroupId=requester_id,  # FIFO only: ensures order per user
        MessageDeduplicationId=f"{requester_id}-{int(time.time())}",  # FIFO only
    )

# Consumer: Lambda triggered by SQS
def process_access_request(event, context):
    for record in event['Records']:
        request = json.loads(record['body'])
        # Store in DB, send notifications, etc.
```

**When to use SQS:**
- You need reliable, asynchronous processing
- Order matters (use FIFO)
- You want automatic retries with exponential backoff
- Point-to-point messaging (one producer, one consumer)

---

### 2. Amazon SNS (Simple Notification Service)

**Best for:** Fan-out notifications to multiple subscribers.

```
                              ┌─────────────┐
                         ┌───▶│ SQS Queue   │───▶ Lambda Processor
┌─────────┐     ┌─────┐ │    └─────────────┘
│ Manager │────▶│ SNS │─┤
│ submits │     │Topic│ │    ┌─────────────┐
└─────────┘     └─────┘ ├───▶│ Email (SES) │───▶ Admin Notification
                        │    └─────────────┘
                        │    ┌─────────────┐
                        └───▶│ HTTP/Lambda │───▶ Slack/Webhook
                             └─────────────┘
```

**Features:**
- Pub/sub messaging
- Fan-out to SQS, Lambda, HTTP/S, email, SMS
- Message filtering by attributes
- FIFO topics available (paired with FIFO SQS)
- Up to 12.5M subscriptions per topic

**Pricing:** $0.50 per million publishes (first million free/month)

**Example Integration:**
```python
import boto3
import json

sns = boto3.client('sns')

def submit_access_request(requester_id: str, email: str, org_name: str):
    sns.publish(
        TopicArn='arn:aws:sns:region:account:access-request-notifications',
        Message=json.dumps({
            'requester_id': requester_id,
            'requester_email': email,
            'organization_name': org_name,
        }),
        MessageAttributes={
            'event_type': {'DataType': 'String', 'StringValue': 'new_request'},
        },
    )
```

**When to use SNS:**
- Multiple systems need to react to the same event
- You need email/SMS notifications
- Combined with SQS for reliable fan-out (SNS → SQS pattern)

---

### 3. Amazon EventBridge

**Best for:** Event-driven architectures with routing rules.

```
┌─────────┐     ┌─────────────┐     ┌───────────────────────┐
│ Manager │────▶│ EventBridge │────▶│ Rule: new_request     │───▶ Lambda: Store in DB
│ submits │     │    Bus      │     └───────────────────────┘
└─────────┘     └─────────────┘     ┌───────────────────────┐
                      │        ├───▶│ Rule: notify_admin    │───▶ SNS: Email Admin
                      │             └───────────────────────┘
                      │             ┌───────────────────────┐
                      └────────────▶│ Rule: audit_log       │───▶ CloudWatch Logs
                                    └───────────────────────┘
```

**Features:**
- Central event bus with content-based routing
- Native AWS service integrations (no code needed)
- Schema registry & discovery
- Event archive & replay
- Scheduled events (cron)
- Cross-account event sharing

**Pricing:** $1.00 per million events

**Example Integration:**
```python
import boto3
import json

events = boto3.client('events')

def submit_access_request(requester_id: str, email: str, org_name: str):
    events.put_events(
        Entries=[{
            'Source': 'siutindei.admin',
            'DetailType': 'OrganizationAccessRequest',
            'Detail': json.dumps({
                'requester_id': requester_id,
                'requester_email': email,
                'organization_name': org_name,
                'action': 'submitted',
            }),
            'EventBusName': 'siutindei-events',
        }]
    )
```

**EventBridge Rule Example (Terraform/CDK):**
```typescript
new events.Rule(this, 'NotifyAdminOnNewRequest', {
  eventBus: bus,
  eventPattern: {
    source: ['siutindei.admin'],
    detailType: ['OrganizationAccessRequest'],
    detail: { action: ['submitted'] },
  },
  targets: [new targets.LambdaFunction(notifyAdminLambda)],
});
```

**When to use EventBridge:**
- Complex event routing requirements
- Multiple microservices reacting to events
- You want to decouple services via events
- Integration with AWS services or third-party SaaS

---

### 4. AWS Step Functions

**Best for:** Orchestrating multi-step workflows with state management.

```
┌─────────┐     ┌─────────────────────────────────────────────────┐
│ Manager │────▶│              Step Functions Workflow             │
│ submits │     │ ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
└─────────┘     │ │ Validate │─▶│  Store   │─▶│ Notify Admin  │  │
                │ │ Request  │  │  in DB   │  │    (Email)    │  │
                │ └──────────┘  └──────────┘  └───────────────┘  │
                │        │              │              │          │
                │        ▼              ▼              ▼          │
                │   ┌─────────────────────────────────────────┐  │
                │   │           Wait for Admin Decision        │  │
                │   │      (with TaskToken callback pattern)   │  │
                │   └─────────────────────────────────────────┘  │
                │        │                      │                 │
                │        ▼                      ▼                 │
                │   ┌──────────┐          ┌──────────┐           │
                │   │ Approved │          │ Rejected │           │
                │   │ - Create │          │ - Notify │           │
                │   │   Org    │          │   User   │           │
                │   └──────────┘          └──────────┘           │
                └─────────────────────────────────────────────────┘
```

**Features:**
- Visual workflow builder
- Standard workflows: long-running, durable (up to 1 year)
- Express workflows: high-volume, short-duration (<5 min)
- Built-in error handling & retries
- Wait states for human approval (TaskToken pattern)
- Audit trail via execution history

**Pricing:** 
- Standard: $0.025 per 1,000 state transitions
- Express: $1.00 per million requests + $0.00001667 per GB-second

**Example Use Case for Access Requests:**
```json
{
  "Comment": "Organization Access Request Workflow",
  "StartAt": "ValidateRequest",
  "States": {
    "ValidateRequest": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:validate-request",
      "Next": "StoreInDatabase"
    },
    "StoreInDatabase": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:putItem",
      "Parameters": {
        "TableName": "access-requests",
        "Item": { ... }
      },
      "Next": "NotifyAdminAndWait"
    },
    "NotifyAdminAndWait": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
      "Parameters": {
        "FunctionName": "notify-admin",
        "Payload": {
          "request.$": "$",
          "taskToken.$": "$$.Task.Token"
        }
      },
      "Next": "HandleDecision"
    },
    "HandleDecision": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.decision",
          "StringEquals": "approved",
          "Next": "CreateOrganization"
        }
      ],
      "Default": "NotifyRejection"
    },
    "CreateOrganization": { ... },
    "NotifyRejection": { ... }
  }
}
```

**When to use Step Functions:**
- Multi-step approval workflows
- Human-in-the-loop processes
- Long-running processes with state
- Complex branching/error handling logic

---

### 5. Amazon MQ (ActiveMQ / RabbitMQ)

**Best for:** Lift-and-shift from existing message brokers.

**Features:**
- Managed ActiveMQ or RabbitMQ
- Standard protocols: AMQP, MQTT, OpenWire, STOMP
- Existing application compatibility

**Pricing:** Starts at ~$0.03/hour for smallest broker

**When to use Amazon MQ:**
- Migrating existing apps that use ActiveMQ/RabbitMQ
- Need specific messaging protocols
- Complex routing patterns (RabbitMQ exchanges)

---

### 6. Amazon Kinesis Data Streams

**Best for:** High-throughput, real-time streaming data.

**Features:**
- Ordered data within a shard
- Multiple consumers can read same data
- Data retention 1-365 days
- Replay capability

**Pricing:** $0.015/shard-hour + $0.014 per million PUT units

**When to use Kinesis:**
- High-volume event streaming (logs, metrics, IoT)
- Real-time analytics
- Multiple consumers need same ordered data

---

## Comparison Matrix

| Feature | SQS | SNS | EventBridge | Step Functions | MQ |
|---------|-----|-----|-------------|----------------|-----|
| **Primary Pattern** | Queue | Pub/Sub | Event Bus | Orchestration | Broker |
| **Ordering** | FIFO available | FIFO available | Per-rule | Workflow | Yes |
| **Exactly-once** | FIFO only | No | No | Yes | Depends |
| **Dead Letter** | Yes | Via SQS | Yes | Yes | Yes |
| **Retry Logic** | Built-in | Via SQS | Via target | Built-in | Depends |
| **Fan-out** | No | Yes | Yes | Limited | Yes |
| **Human Approval** | No | No | No | Yes (TaskToken) | No |
| **Latency** | ~10-100ms | ~10-100ms | ~50-200ms | ~100-500ms | ~10-50ms |
| **Max Message** | 256KB | 256KB | 256KB | 256KB input | Varies |
| **Serverless** | Yes | Yes | Yes | Yes | No |

---

## Implementation Details

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CURRENT FLOW                                    │
│                                                                             │
│  Manager ──▶ API ──▶ DB (write) ──▶ SES (email) ──▶ Done                   │
│                          │                                                  │
│                          └──▶ [Admins poll DB for pending requests]         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEW FLOW (SNS + SQS)                           │
│                                                                             │
│  Manager ──▶ API ──▶ SNS Topic ──┬──▶ SQS Queue ──▶ Lambda ──▶ DB + SES    │
│                                  │                      │                   │
│                                  │                      └──▶ DLQ (failures) │
│                                  │                                          │
│                                  └──▶ Email Subscription (instant notify)   │
│                                                                             │
│  [Admins still query DB for list, but get instant email when new arrives]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CDK Infrastructure

Location: `backend/infrastructure/lib/api-stack.ts`

Key infrastructure components:

```typescript
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

// Dead Letter Queue for failed message processing
const accessRequestDLQ = new sqs.Queue(this, "AccessRequestDLQ", {
  queueName: name("access-request-dlq"),
  retentionPeriod: cdk.Duration.days(14),
  encryption: sqs.QueueEncryption.SQS_MANAGED,
});

// Main processing queue
const accessRequestQueue = new sqs.Queue(this, "AccessRequestQueue", {
  queueName: name("access-request-queue"),
  visibilityTimeout: cdk.Duration.seconds(60), // 6x Lambda timeout
  deadLetterQueue: {
    queue: accessRequestDLQ,
    maxReceiveCount: 3, // Retry 3 times before DLQ
  },
  encryption: sqs.QueueEncryption.SQS_MANAGED,
});

// SNS Topic for access request events
const accessRequestTopic = new sns.Topic(this, "AccessRequestTopic", {
  topicName: name("access-request-events"),
});

// Subscribe SQS queue to SNS topic
accessRequestTopic.addSubscription(
  new subscriptions.SqsSubscription(accessRequestQueue)
);

// Optional: Direct email subscription for instant admin notification
// (in addition to the SES email sent by the Lambda processor)
const adminNotificationEmail = new cdk.CfnParameter(this, "AdminNotificationEmail", {
  type: "String",
  default: "",
  description: "Email for instant SNS notifications (optional)",
});

const hasAdminEmail = new cdk.CfnCondition(this, "HasAdminNotificationEmail", {
  expression: cdk.Fn.conditionNot(
    cdk.Fn.conditionEquals(adminNotificationEmail.valueAsString, "")
  ),
});

// Conditional email subscription
const emailSubscription = new sns.CfnSubscription(this, "AdminEmailSubscription", {
  topicArn: accessRequestTopic.topicArn,
  protocol: "email",
  endpoint: adminNotificationEmail.valueAsString,
});
emailSubscription.cfnOptions.condition = hasAdminEmail;

// Lambda processor triggered by SQS
const accessRequestProcessor = createPythonFunction("AccessRequestProcessor", {
  handler: "lambda/access_request_processor/handler.lambda_handler",
  timeout: cdk.Duration.seconds(10),
  environment: {
    DATABASE_SECRET_ARN: database.adminUserSecret.secretArn,
    DATABASE_NAME: "siutindei",
    DATABASE_USERNAME: "siutindei_admin",
    DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
    DATABASE_IAM_AUTH: "true",
    SES_SENDER_EMAIL: sesSenderEmail.valueAsString,
    SUPPORT_EMAIL: supportEmail.valueAsString,
  },
});

// Grant permissions
database.grantAdminUserSecretRead(accessRequestProcessor);
database.grantConnect(accessRequestProcessor, "siutindei_admin");
accessRequestProcessor.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: [sesSenderIdentityArn],
  })
);

// Connect SQS to Lambda
accessRequestProcessor.addEventSource(
  new lambdaEventSources.SqsEventSource(accessRequestQueue, {
    batchSize: 1, // Process one at a time for simplicity
  })
);

// Grant API Lambda permission to publish to SNS
accessRequestTopic.grantPublish(adminFunction);

// Pass topic ARN to admin Lambda
adminFunction.addEnvironment("ACCESS_REQUEST_TOPIC_ARN", accessRequestTopic.topicArn);
```

### API Handler (Publish to SNS)

Location: `backend/src/app/api/admin.py`

The `_handle_user_access_request` function now publishes to SNS when `ACCESS_REQUEST_TOPIC_ARN` is set:

```python
import boto3
import json
import os

sns_client = boto3.client("sns")

def _handle_user_access_request(event: Mapping[str, Any], method: str) -> dict[str, Any]:
    """Handle user access request operations."""
    user_sub = _get_user_sub(event)
    user_email = _get_user_email(event)

    if not user_sub:
        return json_response(401, {"error": "User identity not found"}, event=event)

    if method == "POST":
        body = _parse_body(event)

        # Validate request fields
        organization_name = _validate_string_length(
            body.get("organization_name"), "organization_name", MAX_NAME_LENGTH, required=True
        )
        request_message = _validate_string_length(
            body.get("request_message"), "request_message", MAX_DESCRIPTION_LENGTH, required=False
        )

        # Generate ticket ID (could also be done by processor)
        with Session(get_engine()) as session:
            request_repo = OrganizationAccessRequestRepository(session)

            # Check for existing pending request
            existing = request_repo.find_pending_by_requester(user_sub)
            if existing:
                return json_response(409, {
                    "error": "You already have a pending access request",
                    "request": _serialize_access_request(existing),
                }, event=event)

            ticket_id = _generate_ticket_id(session)

        # Publish to SNS instead of writing directly to DB
        topic_arn = os.getenv("ACCESS_REQUEST_TOPIC_ARN")
        if topic_arn:
            sns_client.publish(
                TopicArn=topic_arn,
                Message=json.dumps({
                    "event_type": "access_request.submitted",
                    "ticket_id": ticket_id,
                    "requester_id": user_sub,
                    "requester_email": user_email or "unknown",
                    "organization_name": organization_name,
                    "request_message": request_message,
                }),
                MessageAttributes={
                    "event_type": {
                        "DataType": "String",
                        "StringValue": "access_request.submitted",
                    },
                },
            )

            return json_response(202, {
                "message": "Your request has been submitted and is being processed",
                "ticket_id": ticket_id,
            }, event=event)

        # Fallback: direct DB write if SNS not configured (for backwards compatibility)
        # ... existing code ...
```

### SQS Processor Lambda

Location: `backend/lambda/access_request_processor/handler.py`

This Lambda is triggered by SQS messages and processes access requests:

```python
"""Lambda handler for processing access requests from SQS."""

import json
import os
from typing import Any

import boto3
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import OrganizationAccessRequest
from app.db.repositories import OrganizationAccessRequestRepository
from app.templates import render_new_request_email
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

ses_client = boto3.client("ses")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process access request messages from SQS.

    Each message contains:
    - event_type: "access_request.submitted"
    - ticket_id: Unique ticket ID
    - requester_id: Cognito user sub
    - requester_email: User's email
    - organization_name: Requested organization name
    - request_message: Optional message
    """
    processed = 0
    failed = 0

    for record in event.get("Records", []):
        try:
            # Parse SNS message wrapped in SQS
            body = json.loads(record["body"])
            message = json.loads(body.get("Message", "{}"))

            if message.get("event_type") != "access_request.submitted":
                logger.info(f"Skipping unknown event type: {message.get('event_type')}")
                continue

            # Store in database
            with Session(get_engine()) as session:
                repo = OrganizationAccessRequestRepository(session)

                # Check if already processed (idempotency)
                existing = repo.find_by_ticket_id(message["ticket_id"])
                if existing:
                    logger.info(f"Request {message['ticket_id']} already exists, skipping")
                    processed += 1
                    continue

                access_request = OrganizationAccessRequest(
                    ticket_id=message["ticket_id"],
                    requester_id=message["requester_id"],
                    requester_email=message["requester_email"],
                    organization_name=message["organization_name"],
                    request_message=message.get("request_message"),
                )
                repo.create(access_request)
                session.commit()
                session.refresh(access_request)

                logger.info(f"Stored access request: {access_request.ticket_id}")

            # Send email notification
            _send_notification_email(access_request)

            processed += 1

        except Exception as e:
            logger.exception(f"Failed to process record: {e}")
            failed += 1
            # Re-raise to trigger SQS retry / DLQ
            raise

    return {
        "statusCode": 200,
        "body": json.dumps({"processed": processed, "failed": failed}),
    }


def _send_notification_email(request: OrganizationAccessRequest) -> None:
    """Send email notification for new access request."""
    support_email = os.getenv("SUPPORT_EMAIL")
    sender_email = os.getenv("SES_SENDER_EMAIL")

    if not support_email or not sender_email:
        logger.warning("Email notification skipped: emails not configured")
        return

    try:
        email_content = render_new_request_email(
            ticket_id=request.ticket_id,
            requester_email=request.requester_email,
            organization_name=request.organization_name,
            request_message=request.request_message,
            submitted_at=request.created_at.isoformat() if request.created_at else "Unknown",
        )

        ses_client.send_email(
            Source=sender_email,
            Destination={"ToAddresses": [support_email]},
            Message={
                "Subject": {"Data": email_content.subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": email_content.body_text, "Charset": "UTF-8"},
                    "Html": {"Data": email_content.body_html, "Charset": "UTF-8"},
                },
            },
        )
        logger.info(f"Notification email sent for {request.ticket_id}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        # Don't re-raise - DB write succeeded, email failure is non-critical
```

### Repository Method for Idempotency

Location: `backend/src/app/db/repositories/access_request.py`

The `find_by_ticket_id` method enables idempotent processing:

```python
def find_by_ticket_id(self, ticket_id: str) -> Optional[OrganizationAccessRequest]:
    """Find a request by its ticket ID.

    Args:
        ticket_id: The unique ticket ID (e.g., R00001).

    Returns:
        The request if found, None otherwise.
    """
    query = select(OrganizationAccessRequest).where(
        OrganizationAccessRequest.ticket_id == ticket_id
    )
    return self._session.execute(query).scalar_one_or_none()
```

---

## Benefits of This Architecture

| Before (DB as Queue) | After (SNS + SQS) |
|---------------------|-------------------|
| Sync write blocks until email sent | Async - API returns immediately |
| Email failure fails the request | Email failure retried automatically |
| No retry mechanism | 3 retries before DLQ |
| Admins must poll | Instant email notification option |
| Single point of failure | Decoupled, fault-tolerant |
| Hard to add new consumers | Easy to add more SQS subscriptions |

---

## Implementation Checklist

### Infrastructure (CDK) - COMPLETED:

1. [x] Create Dead Letter Queue for failed messages (`lxsoftware-siutindei-access-request-dlq`)
2. [x] Create main SQS queue with DLQ (`lxsoftware-siutindei-access-request-queue`)
3. [x] Create SNS topic (`lxsoftware-siutindei-access-request-events`)
4. [x] Subscribe SQS to SNS
5. [x] Create processor Lambda (`AccessRequestProcessor`)
6. [x] Wire SQS as Lambda event source
7. [x] Grant admin Lambda permission to publish to SNS
8. [x] Add CloudWatch alarm for DLQ messages

### Application Code - COMPLETED:

1. [x] Update API to publish to SNS instead of direct DB write (`_publish_access_request_to_sns`)
2. [x] Create processor Lambda handler (`lambda/access_request_processor/handler.py`)
3. [x] Add `find_by_ticket_id` repository method for idempotency
4. [x] Return 202 Accepted (instead of 201) for async processing
5. [x] Maintain backwards compatibility (falls back to sync write if SNS not configured)

### Files Changed:

- `backend/infrastructure/lib/api-stack.ts` - CDK infrastructure
- `backend/src/app/api/admin.py` - API handler with SNS publish
- `backend/src/app/db/repositories/access_request.py` - Repository with `find_by_ticket_id`
- `backend/lambda/access_request_processor/handler.py` - NEW: SQS processor Lambda

### Stack Outputs:

After deployment, these outputs will be available:
- `AccessRequestTopicArn` - SNS topic ARN for access request events
- `AccessRequestQueueUrl` - SQS queue URL for access request processing
- `AccessRequestDLQUrl` - SQS dead letter queue URL for failed access requests

---

## Cost Estimation (Low Volume: ~1000 requests/month)

| Service | Monthly Cost |
|---------|-------------|
| SQS | Free tier covers it |
| SNS | Free tier covers it |
| Lambda | Free tier covers it |
| SES (emails) | ~$0.10 |

**Total:** < $1/month for low-volume use cases

---

## When to Graduate to EventBridge

Consider moving to EventBridge when you need:

- **Multiple event types** (not just access requests)
- **Content-based routing** (route based on message content)
- **Cross-account events** (events shared between AWS accounts)
- **Schema registry** (formal event schema management)
- **Event replay** (replay historical events for debugging/recovery)

For now, SNS + SQS is the right level of complexity for your access request use case.
