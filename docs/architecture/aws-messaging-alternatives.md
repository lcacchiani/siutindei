# AWS Messaging Alternatives to Database Polling

## Current Implementation

The application currently uses PostgreSQL tables to manage "requests" (specifically `organization_access_requests`). This pattern involves:

1. **Producers** (managers) write request records to the database
2. **Consumers** (admins) poll the database for pending requests
3. **Status updates** track request lifecycle (pending → approved/rejected)

### Drawbacks of Database-as-Queue

| Issue | Impact |
|-------|--------|
| **Polling overhead** | Constant database queries, even when no new requests |
| **No push notifications** | Admins must actively check for new requests |
| **No retry mechanisms** | Failed processing requires manual intervention |
| **No dead letter queue** | No automatic handling of poison messages |
| **Scaling limitations** | Database becomes bottleneck under high load |
| **No fan-out** | Can't easily notify multiple systems |

---

## AWS Messaging Options

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

## Recommendation for Access Requests

For your `OrganizationAccessRequest` use case, I recommend a **hybrid approach**:

### Option A: Simple (SNS + SQS + Database)

Keep the database as the source of truth, but add messaging for notifications:

```
┌─────────┐      ┌─────┐      ┌─────────────┐
│ Manager │─────▶│ API │─────▶│ DB (writes) │
│ submits │      │     │      └─────────────┘
└─────────┘      │     │            │
                 │     │      ┌─────▼─────┐      ┌─────────────┐
                 │     │─────▶│    SNS    │─────▶│ Admin Email │
                 │     │      │   Topic   │      └─────────────┘
                 └─────┘      └───────────┘
```

**Benefits:**
- Minimal change to existing code
- Database remains source of truth
- Admins get push notifications

### Option B: Event-Driven (EventBridge + Database)

Use EventBridge as the central hub:

```
┌─────────┐      ┌─────────────┐      ┌────────────┐
│ Manager │─────▶│ EventBridge │─────▶│ Lambda:    │───▶ Database
│ submits │      │     Bus     │      │ Store      │
└─────────┘      └─────────────┘      └────────────┘
                        │             ┌────────────┐
                        ├────────────▶│ Lambda:    │───▶ SES Email
                        │             │ Notify     │
                        │             └────────────┘
                        │             ┌────────────┐
                        └────────────▶│ CloudWatch │───▶ Audit Log
                                      │ Logs       │
                                      └────────────┘
```

**Benefits:**
- Decoupled architecture
- Easy to add new consumers
- Built-in audit trail
- Future-proof for more event types

### Option C: Full Workflow (Step Functions)

For complete workflow management:

```
Manager ──▶ Step Functions Workflow ──▶ [Validate → Store → Notify → Wait → Process Decision]
```

**Benefits:**
- Complete audit trail of request lifecycle
- Built-in human approval pattern
- Automatic timeout/escalation handling
- Visual workflow monitoring

---

## Implementation Checklist

### For Option A (SNS + Database):

1. [ ] Create SNS topic for access request notifications
2. [ ] Add email subscription for admin team
3. [ ] Update API to publish to SNS after database write
4. [ ] Add CloudWatch alarms for failed publishes

### For Option B (EventBridge):

1. [ ] Create custom EventBridge bus
2. [ ] Define event schema for `OrganizationAccessRequest`
3. [ ] Create rules for: store, notify, audit
4. [ ] Update API to publish events
5. [ ] Add DLQ for failed deliveries

### For Option C (Step Functions):

1. [ ] Design state machine for request workflow
2. [ ] Implement Lambda functions for each step
3. [ ] Set up TaskToken pattern for admin approval
4. [ ] Create API endpoint to receive admin decisions
5. [ ] Configure execution history retention

---

## Cost Estimation (Low Volume: ~1000 requests/month)

| Service | Monthly Cost |
|---------|-------------|
| SQS | Free tier covers it |
| SNS | Free tier covers it |
| EventBridge | ~$0.001 |
| Step Functions Standard | ~$0.025 |
| SES (emails) | ~$0.10 |

**Total:** < $1/month for low-volume use cases

---

## Next Steps

1. **Decide on architecture** based on complexity needs
2. **Start with Option A** if you just need admin notifications
3. **Graduate to Option B** when you need multiple consumers
4. **Use Option C** when you need full workflow orchestration

For your current use case (access requests with admin review), I recommend **starting with Option A** (SNS for notifications while keeping DB as source of truth), with a clear path to migrate to **Option B** (EventBridge) as your event-driven needs grow.
