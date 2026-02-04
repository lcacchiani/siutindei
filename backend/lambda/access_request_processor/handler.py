"""Lambda handler for processing access requests from SQS.

This Lambda is triggered by SQS messages that originate from the SNS topic.
It processes access request submissions asynchronously:
1. Parses the SNS message from SQS
2. Stores the request in the database (with idempotency check)
3. Sends email notification to support/admin

The decoupled architecture provides:
- Automatic retries (3 attempts before DLQ)
- Fault tolerance (email failures don't block DB writes)
- Scalability (can process multiple requests concurrently)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.models import OrganizationAccessRequest
from app.db.repositories import OrganizationAccessRequestRepository
from app.templates import render_new_request_email
from app.utils.logging import configure_logging, get_logger

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Initialize AWS clients
ses_client = boto3.client("ses")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process access request messages from SQS.

    Each SQS message contains an SNS notification with:
    - event_type: "access_request.submitted"
    - ticket_id: Unique ticket ID (e.g., R00001)
    - requester_id: Cognito user sub
    - requester_email: User's email
    - organization_name: Requested organization name
    - request_message: Optional message from requester

    Args:
        event: SQS event containing records to process.
        context: Lambda context object.

    Returns:
        Response with processing statistics.

    Raises:
        Exception: If processing fails (triggers SQS retry).
    """
    processed = 0
    skipped = 0

    for record in event.get("Records", []):
        try:
            # Parse SNS message wrapped in SQS record
            sqs_body = json.loads(record["body"])

            # SNS wraps the actual message in a "Message" field
            message_str = sqs_body.get("Message", "{}")
            message = json.loads(message_str)

            event_type = message.get("event_type")
            if event_type != "access_request.submitted":
                logger.info(f"Skipping event type: {event_type}")
                skipped += 1
                continue

            ticket_id = message.get("ticket_id")
            if not ticket_id:
                logger.warning("Message missing ticket_id, skipping")
                skipped += 1
                continue

            logger.info(f"Processing access request: {ticket_id}")

            # Store in database with idempotency check
            access_request = _store_access_request(message)

            if access_request is None:
                # Already processed (idempotent)
                logger.info(f"Request {ticket_id} already exists, skipping")
                skipped += 1
                continue

            # Send email notification (non-blocking)
            _send_notification_email(access_request)

            processed += 1
            logger.info(f"Successfully processed request: {ticket_id}")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message JSON: {e}")
            # Re-raise to trigger retry
            raise
        except Exception as e:
            logger.exception(f"Failed to process record: {e}")
            # Re-raise to trigger SQS retry / DLQ
            raise

    result = {
        "statusCode": 200,
        "body": json.dumps({
            "processed": processed,
            "skipped": skipped,
        }),
    }
    logger.info(f"Processing complete: {result}")
    return result


def _store_access_request(
    message: dict[str, Any],
) -> OrganizationAccessRequest | None:
    """Store access request in database with idempotency check.

    Args:
        message: Parsed SNS message containing request data.

    Returns:
        The created OrganizationAccessRequest, or None if already exists.
    """
    ticket_id = message["ticket_id"]

    with Session(get_engine()) as session:
        repo = OrganizationAccessRequestRepository(session)

        # Idempotency check: skip if already processed
        existing = repo.find_by_ticket_id(ticket_id)
        if existing:
            return None

        # Create new access request
        access_request = OrganizationAccessRequest(
            ticket_id=ticket_id,
            requester_id=message["requester_id"],
            requester_email=message["requester_email"],
            organization_name=message["organization_name"],
            request_message=message.get("request_message"),
        )

        repo.create(access_request)
        session.commit()
        session.refresh(access_request)

        logger.info(f"Stored access request in database: {ticket_id}")
        return access_request


def _send_notification_email(request: OrganizationAccessRequest) -> None:
    """Send email notification for new access request.

    This is a best-effort operation - failures are logged but don't
    cause the overall processing to fail (DB write already succeeded).

    Args:
        request: The access request to notify about.
    """
    support_email = os.getenv("SUPPORT_EMAIL")
    sender_email = os.getenv("SES_SENDER_EMAIL")

    if not support_email or not sender_email:
        logger.warning(
            "Email notification skipped: SUPPORT_EMAIL or SES_SENDER_EMAIL not configured"
        )
        return

    try:
        # Format submitted_at timestamp
        submitted_at = (
            request.created_at.isoformat()
            if request.created_at
            else datetime.now(timezone.utc).isoformat()
        )

        email_content = render_new_request_email(
            ticket_id=request.ticket_id,
            requester_email=request.requester_email,
            organization_name=request.organization_name,
            request_message=request.request_message,
            submitted_at=submitted_at,
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
        # Log but don't re-raise - DB write succeeded, email is secondary
        logger.error(f"Failed to send notification email for {request.ticket_id}: {e}")
