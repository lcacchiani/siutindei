"""Lambda handler for processing manager requests and organization suggestions from SQS.

This Lambda is triggered by SQS messages that originate from the SNS topic.
It processes submissions asynchronously:
1. Parses the SNS message from SQS
2. Stores the request/suggestion in the database (with idempotency check)
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
from app.db.models import OrganizationAccessRequest, OrganizationSuggestion
from app.db.repositories import (
    OrganizationAccessRequestRepository,
    OrganizationSuggestionRepository,
)
from app.templates import render_new_request_email, render_new_suggestion_email
from app.utils.logging import configure_logging, get_logger

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Initialize AWS clients
ses_client = boto3.client("ses")

# Supported event types
SUPPORTED_EVENT_TYPES = {
    "manager_request.submitted",
    "organization_suggestion.submitted",
}


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process manager request and organization suggestion messages from SQS.

    Each SQS message contains an SNS notification with an event_type field.

    For manager_request.submitted:
    - ticket_id: Unique ticket ID (e.g., R00001)
    - requester_id: Cognito user sub
    - requester_email: User's email
    - organization_name: Requested organization name
    - request_message: Optional message from requester

    For organization_suggestion.submitted:
    - ticket_id: Unique ticket ID (e.g., S00001)
    - suggester_id: Cognito user sub
    - suggester_email: User's email
    - organization_name: Suggested organization name
    - description: Optional description
    - suggested_district: Optional district
    - suggested_address: Optional address
    - suggested_lat: Optional latitude
    - suggested_lng: Optional longitude
    - media_urls: Optional list of media URLs
    - additional_notes: Optional notes

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
            if event_type not in SUPPORTED_EVENT_TYPES:
                logger.info(f"Skipping unsupported event type: {event_type}")
                skipped += 1
                continue

            ticket_id = message.get("ticket_id")
            if not ticket_id:
                logger.warning("Message missing ticket_id, skipping")
                skipped += 1
                continue

            if event_type == "manager_request.submitted":
                logger.info(f"Processing manager request: {ticket_id}")

                # Store in database with idempotency check
                manager_request = _store_manager_request(message)

                if manager_request is None:
                    logger.info(
                        f"Request {ticket_id} already exists, skipping"
                    )
                    skipped += 1
                    continue

                # Send email notification (non-blocking)
                _send_request_notification_email(manager_request)

            elif event_type == "organization_suggestion.submitted":
                logger.info(
                    f"Processing organization suggestion: {ticket_id}"
                )

                # Store in database with idempotency check
                suggestion = _store_organization_suggestion(message)

                if suggestion is None:
                    logger.info(
                        f"Suggestion {ticket_id} already exists, skipping"
                    )
                    skipped += 1
                    continue

                # Send email notification (non-blocking)
                _send_suggestion_notification_email(suggestion)

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


# --- Manager request processing ---


def _store_manager_request(
    message: dict[str, Any],
) -> OrganizationAccessRequest | None:
    """Store manager request in database with idempotency check.

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

        # Create new manager request
        manager_request = OrganizationAccessRequest(
            ticket_id=ticket_id,
            requester_id=message["requester_id"],
            requester_email=message["requester_email"],
            organization_name=message["organization_name"],
            request_message=message.get("request_message"),
        )

        repo.create(manager_request)
        session.commit()
        session.refresh(manager_request)

        logger.info(f"Stored manager request in database: {ticket_id}")
        return manager_request


def _send_request_notification_email(
    request: OrganizationAccessRequest,
) -> None:
    """Send email notification for new manager request.

    This is a best-effort operation - failures are logged but don't
    cause the overall processing to fail (DB write already succeeded).

    Args:
        request: The manager request to notify about.
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
        logger.info(f"Notification email sent for {request.ticket_id}")

    except Exception as e:
        # Log but don't re-raise - DB write succeeded, email is secondary
        logger.error(
            f"Failed to send notification email for "
            f"{request.ticket_id}: {e}"
        )


# --- Organization suggestion processing ---


def _store_organization_suggestion(
    message: dict[str, Any],
) -> OrganizationSuggestion | None:
    """Store organization suggestion in database with idempotency check.

    Args:
        message: Parsed SNS message containing suggestion data.

    Returns:
        The created OrganizationSuggestion, or None if already exists.
    """
    ticket_id = message["ticket_id"]

    with Session(get_engine()) as session:
        repo = OrganizationSuggestionRepository(session)

        # Idempotency check: skip if already processed
        existing = repo.find_by_ticket_id(ticket_id)
        if existing:
            return None

        # Parse optional numeric fields
        suggested_lat = message.get("suggested_lat")
        suggested_lng = message.get("suggested_lng")

        # Create new organization suggestion
        suggestion = OrganizationSuggestion(
            ticket_id=ticket_id,
            suggester_id=message["suggester_id"],
            suggester_email=message["suggester_email"],
            organization_name=message["organization_name"],
            description=message.get("description"),
            suggested_district=message.get("suggested_district"),
            suggested_address=message.get("suggested_address"),
            suggested_lat=suggested_lat,
            suggested_lng=suggested_lng,
            media_urls=message.get("media_urls", []),
            additional_notes=message.get("additional_notes"),
        )

        repo.create(suggestion)
        session.commit()
        session.refresh(suggestion)

        logger.info(
            f"Stored organization suggestion in database: {ticket_id}"
        )
        return suggestion


def _send_suggestion_notification_email(
    suggestion: OrganizationSuggestion,
) -> None:
    """Send email notification for new organization suggestion.

    This is a best-effort operation - failures are logged but don't
    cause the overall processing to fail (DB write already succeeded).

    Args:
        suggestion: The organization suggestion to notify about.
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
        # Format submitted_at timestamp
        submitted_at = (
            suggestion.created_at.isoformat()
            if suggestion.created_at
            else datetime.now(timezone.utc).isoformat()
        )

        email_content = render_new_suggestion_email(
            ticket_id=suggestion.ticket_id,
            suggester_email=suggestion.suggester_email,
            organization_name=suggestion.organization_name,
            description=suggestion.description,
            district=suggestion.suggested_district,
            address=suggestion.suggested_address,
            additional_notes=suggestion.additional_notes,
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
            f"Suggestion notification email sent for "
            f"{suggestion.ticket_id}"
        )

    except Exception as e:
        # Log but don't re-raise - DB write succeeded, email is secondary
        logger.error(
            f"Failed to send suggestion notification email for "
            f"{suggestion.ticket_id}: {e}"
        )
