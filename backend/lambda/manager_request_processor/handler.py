"""Lambda handler for processing tickets (access requests + suggestions) from SQS.

This Lambda is triggered by SQS messages that originate from the SNS topic.
It processes submissions asynchronously:
1. Parses the SNS message from SQS
2. Stores the ticket in the unified tickets table (with idempotency check)
3. Sends email notification to support/admin

Supported event types:
- manager_request.submitted: Manager access requests
- organization_suggestion.submitted: Organization suggestions from public users

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
from app.db.models import Ticket, TicketType
from app.db.repositories import TicketRepository
from app.templates import render_new_request_email, render_new_suggestion_email
from app.utils.logging import configure_logging, get_logger

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Initialize AWS clients
ses_client = boto3.client("ses")

# Map SNS event types to ticket types
EVENT_TYPE_MAP = {
    "manager_request.submitted": TicketType.ACCESS_REQUEST,
    "organization_suggestion.submitted": TicketType.ORGANIZATION_SUGGESTION,
}


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process ticket messages from SQS.

    Each SQS message contains an SNS notification with an event_type field
    that maps to a ticket_type in the unified tickets table.

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
            ticket_type = EVENT_TYPE_MAP.get(event_type)
            if ticket_type is None:
                logger.info(f"Skipping unsupported event type: {event_type}")
                skipped += 1
                continue

            ticket_id = message.get("ticket_id")
            if not ticket_id:
                logger.warning("Message missing ticket_id, skipping")
                skipped += 1
                continue

            logger.info(f"Processing {event_type}: {ticket_id}")

            # Store in database with idempotency check
            ticket = _store_ticket(message, ticket_type)

            if ticket is None:
                logger.info(
                    f"Ticket {ticket_id} already exists, skipping"
                )
                skipped += 1
                continue

            # Send email notification (non-blocking)
            _send_notification_email(ticket)

            processed += 1
            logger.info(f"Successfully processed {event_type}: {ticket_id}")

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
        "body": json.dumps(
            {
                "processed": processed,
                "skipped": skipped,
            }
        ),
    }
    logger.info(f"Processing complete: {result}")
    return result


def _store_ticket(
    message: dict[str, Any],
    ticket_type: TicketType,
) -> Ticket | None:
    """Store ticket in database with idempotency check.

    Args:
        message: Parsed SNS message containing ticket data.
        ticket_type: The type of ticket to create.

    Returns:
        The created Ticket, or None if already exists.
    """
    ticket_id = message["ticket_id"]

    # Normalize field names: access requests use requester_*, suggestions
    # use suggester_*. The unified model uses submitter_*.
    submitter_id = message.get("submitter_id") or message.get(
        "requester_id"
    ) or message.get("suggester_id")
    submitter_email = message.get("submitter_email") or message.get(
        "requester_email"
    ) or message.get("suggester_email")

    with Session(get_engine()) as session:
        repo = TicketRepository(session)

        # Idempotency check: skip if already processed
        existing = repo.find_by_ticket_id(ticket_id)
        if existing:
            return None

        # Build the ticket
        ticket = Ticket(
            ticket_id=ticket_id,
            ticket_type=ticket_type,
            submitter_id=submitter_id,
            submitter_email=submitter_email,
            organization_name=message["organization_name"],
            message=message.get("request_message")
            or message.get("additional_notes")
            or message.get("message"),
        )

        # Suggestion-specific fields
        if ticket_type == TicketType.ORGANIZATION_SUGGESTION:
            ticket.description = message.get("description")
            ticket.suggested_district = message.get("suggested_district")
            ticket.suggested_address = message.get("suggested_address")
            ticket.suggested_lat = message.get("suggested_lat")
            ticket.suggested_lng = message.get("suggested_lng")
            ticket.media_urls = message.get("media_urls", [])

        repo.create(ticket)
        session.commit()
        session.refresh(ticket)

        logger.info(
            f"Stored ticket in database: {ticket_id} "
            f"(type={ticket_type.value})"
        )
        return ticket


def _send_notification_email(ticket: Ticket) -> None:
    """Send email notification for a new ticket.

    Dispatches to the appropriate email template based on ticket type.
    This is a best-effort operation - failures are logged but don't
    cause the overall processing to fail (DB write already succeeded).

    Args:
        ticket: The ticket to notify about.
    """
    support_email = os.getenv("SUPPORT_EMAIL")
    sender_email = os.getenv("SES_SENDER_EMAIL")

    if not support_email or not sender_email:
        logger.warning(
            "Email notification skipped: SUPPORT_EMAIL or "
            "SES_SENDER_EMAIL not configured"
        )
        return

    try:
        submitted_at = (
            ticket.created_at.isoformat()
            if ticket.created_at
            else datetime.now(timezone.utc).isoformat()
        )

        if ticket.ticket_type == TicketType.ACCESS_REQUEST:
            email_content = render_new_request_email(
                ticket_id=ticket.ticket_id,
                requester_email=ticket.submitter_email,
                organization_name=ticket.organization_name,
                request_message=ticket.message,
                submitted_at=submitted_at,
            )
        else:
            email_content = render_new_suggestion_email(
                ticket_id=ticket.ticket_id,
                suggester_email=ticket.submitter_email,
                organization_name=ticket.organization_name,
                description=ticket.description,
                district=ticket.suggested_district,
                address=ticket.suggested_address,
                additional_notes=ticket.message,
                submitted_at=submitted_at,
            )

        ses_client.send_email(
            Source=sender_email,
            Destination={"ToAddresses": [support_email]},
            Message={
                "Subject": {
                    "Data": email_content.subject,
                    "Charset": "UTF-8",
                },
                "Body": {
                    "Text": {
                        "Data": email_content.body_text,
                        "Charset": "UTF-8",
                    },
                    "Html": {
                        "Data": email_content.body_html,
                        "Charset": "UTF-8",
                    },
                },
            },
        )
        logger.info(
            f"Notification email sent for {ticket.ticket_id}"
        )

    except Exception as e:
        # Log but don't re-raise - DB write succeeded, email is secondary
        logger.error(
            f"Failed to send notification email for "
            f"{ticket.ticket_id}: {e}"
        )
