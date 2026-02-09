"""Feedback handlers for user and admin routes."""

from __future__ import annotations

import json
import os
from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy import text as sa_text
from sqlalchemy.orm import Session

from app.api.admin_auth import (
    _get_user_email,
    _get_user_sub,
    _set_session_audit_context,
)
from app.api.admin_cognito import _adjust_user_feedback_stars
from app.api.admin_request import (
    _encode_cursor,
    _parse_body,
    _parse_cursor,
    _parse_uuid,
    _query_param,
)
from app.api.admin_tickets import _serialize_ticket
from app.api.admin_validators import (
    MAX_DESCRIPTION_LENGTH,
    MAX_FEEDBACK_LABELS_COUNT,
    MAX_NAME_LENGTH,
    _validate_email,
    _validate_string_length,
)
from app.db.engine import get_engine
from app.db.models import OrganizationFeedback, TicketType
from app.db.repositories import (
    FeedbackLabelRepository,
    OrganizationFeedbackRepository,
    OrganizationRepository,
    TicketRepository,
)
from app.exceptions import NotFoundError, ValidationError
from app.services.aws_clients import get_sns_client
from app.utils import json_response, parse_int
from app.utils.logging import get_logger
from app.utils.translations import build_translation_map

logger = get_logger(__name__)


def _handle_user_feedback(
    event: Mapping[str, Any],
    method: str,
) -> dict[str, Any]:
    """Handle user feedback submissions."""
    user_sub = _get_user_sub(event)
    user_email = _get_user_email(event)

    if not user_sub:
        return json_response(401, {"error": "User identity not found"}, event=event)

    if method == "GET":
        return _get_user_feedback(event, user_sub)
    if method == "POST":
        return _submit_user_feedback(event, user_sub, user_email)

    return json_response(405, {"error": "Method not allowed"}, event=event)


def _handle_user_feedback_labels(event: Mapping[str, Any]) -> dict[str, Any]:
    """List feedback labels for authenticated users."""
    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = FeedbackLabelRepository(session)
        labels = repo.get_all_sorted()
        return json_response(
            200,
            {
                "items": [
                    {
                        "id": str(label.id),
                        "name": label.name,
                        "name_translations": build_translation_map(
                            label.name,
                            label.name_translations,
                        ),
                        "display_order": label.display_order,
                    }
                    for label in labels
                ]
            },
            event=event,
        )


def _get_user_feedback(
    event: Mapping[str, Any],
    user_sub: str,
) -> dict[str, Any]:
    """Get the user's feedback history."""
    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = TicketRepository(session)
        feedbacks = repo.find_by_submitter(
            user_sub,
            ticket_type=TicketType.ORGANIZATION_FEEDBACK,
            limit=50,
        )
        pending = repo.find_pending_by_submitter(
            user_sub,
            TicketType.ORGANIZATION_FEEDBACK,
        )
        return json_response(
            200,
            {
                "has_pending_feedback": pending is not None,
                "feedbacks": [_serialize_ticket(item) for item in feedbacks],
            },
            event=event,
        )


def _submit_user_feedback(
    event: Mapping[str, Any],
    user_sub: str,
    user_email: Optional[str],
) -> dict[str, Any]:
    """Submit new organization feedback."""
    body = _parse_body(event)
    organization_id_raw = body.get("organization_id")
    if not organization_id_raw:
        raise ValidationError("organization_id is required", field="organization_id")
    organization_id = _parse_uuid(organization_id_raw)

    stars = _parse_feedback_stars(body.get("stars"))
    description = _validate_string_length(
        body.get("description"),
        "description",
        MAX_DESCRIPTION_LENGTH,
        required=False,
    )
    label_ids = _parse_label_ids(body.get("label_ids"))

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        ticket_repo = TicketRepository(session)
        label_repo = FeedbackLabelRepository(session)
        org_repo = OrganizationRepository(session)

        existing = ticket_repo.find_pending_by_submitter(
            user_sub,
            TicketType.ORGANIZATION_FEEDBACK,
        )
        if existing:
            return json_response(
                409,
                {
                    "error": "You already have a pending feedback submission",
                    "feedback": _serialize_ticket(existing),
                },
                event=event,
            )

        organization = org_repo.get_by_id(organization_id)
        if organization is None:
            raise NotFoundError("organization", str(organization_id))

        _validate_feedback_labels(label_repo, label_ids)
        ticket_id = _generate_feedback_ticket_id(session)

    topic_arn = os.getenv("FEEDBACK_TOPIC_ARN") or os.getenv(
        "MANAGER_REQUEST_TOPIC_ARN"
    )
    if not topic_arn:
        logger.error("FEEDBACK_TOPIC_ARN not configured")
        return json_response(
            500,
            {"error": "Service configuration error. Please contact support."},
            event=event,
        )

    return _publish_feedback_to_sns(
        event=event,
        topic_arn=topic_arn,
        ticket_id=ticket_id,
        user_sub=user_sub,
        user_email=user_email or "unknown",
        organization_id=str(organization.id),
        organization_name=organization.name,
        stars=stars,
        label_ids=[str(label_id) for label_id in label_ids],
        description=description,
    )


def _publish_feedback_to_sns(
    event: Mapping[str, Any],
    topic_arn: str,
    ticket_id: str,
    user_sub: str,
    user_email: str,
    organization_id: str,
    organization_name: str,
    stars: int,
    label_ids: list[str],
    description: Optional[str],
) -> dict[str, Any]:
    """Publish feedback to SNS for async processing."""
    sns_client = get_sns_client()
    try:
        sns_client.publish(
            TopicArn=topic_arn,
            Message=json.dumps(
                {
                    "event_type": "organization_feedback.submitted",
                    "ticket_id": ticket_id,
                    "submitter_id": user_sub,
                    "submitter_email": user_email,
                    "organization_id": organization_id,
                    "organization_name": organization_name,
                    "feedback_stars": stars,
                    "feedback_label_ids": label_ids,
                    "feedback_text": description,
                }
            ),
            MessageAttributes={
                "event_type": {
                    "DataType": "String",
                    "StringValue": "organization_feedback.submitted",
                }
            },
        )
        logger.info(f"Published feedback to SNS: {ticket_id}")
        return json_response(
            202,
            {
                "message": "Your feedback has been submitted and is being processed",
                "ticket_id": ticket_id,
            },
            event=event,
        )
    except Exception as exc:
        logger.exception(f"Failed to publish feedback to SNS: {exc}")
        return json_response(
            500,
            {"error": "Failed to submit feedback. Please try again."},
            event=event,
        )


def _generate_feedback_ticket_id(session: Session) -> str:
    """Generate a unique progressive ticket ID in format F + 5 digits."""
    result = session.execute(
        sa_text(
            "SELECT MAX(CAST(SUBSTRING(ticket_id FROM 2) AS BIGINT)) "
            "FROM tickets "
            "WHERE ticket_id LIKE 'F%'"
        )
    ).scalar()
    next_number = (result or 0) + 1
    return f"F{next_number:05d}"


def _handle_admin_feedback(
    event: Mapping[str, Any],
    method: str,
    feedback_id: Optional[str],
) -> dict[str, Any]:
    """Handle admin feedback CRUD endpoints."""
    try:
        if method == "GET":
            return _list_feedback(event, feedback_id)
        if method == "POST":
            return _create_feedback(event)
        if method == "PUT" and feedback_id:
            return _update_feedback(event, feedback_id)
        if method == "DELETE" and feedback_id:
            return _delete_feedback(event, feedback_id)
        return json_response(405, {"error": "Method not allowed"}, event=event)
    except ValidationError as exc:
        logger.warning(f"Validation error: {exc.message}")
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except NotFoundError as exc:
        return json_response(exc.status_code, exc.to_dict(), event=event)
    except Exception as exc:
        logger.exception("Unexpected error in admin feedback handler")
        return json_response(
            500, {"error": "Internal server error", "detail": str(exc)}, event=event
        )


def _list_feedback(
    event: Mapping[str, Any],
    feedback_id: Optional[str],
) -> dict[str, Any]:
    """List feedback entries or return a specific one."""
    limit = parse_int(_query_param(event, "limit")) or 50
    if limit < 1 or limit > 200:
        raise ValidationError("limit must be between 1 and 200", field="limit")

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = OrganizationFeedbackRepository(session)

        if feedback_id:
            entity = repo.get_by_id(_parse_uuid(feedback_id))
            if entity is None:
                raise NotFoundError("organization_feedback", feedback_id)
            return json_response(200, _serialize_feedback(entity), event=event)

        cursor = _parse_cursor(_query_param(event, "cursor"))
        rows = repo.get_all(limit=limit + 1, cursor=cursor)
        has_more = len(rows) > limit
        trimmed = list(rows)[:limit]
        next_cursor = _encode_cursor(trimmed[-1].id) if has_more and trimmed else None

        return json_response(
            200,
            {
                "items": [_serialize_feedback(row) for row in trimmed],
                "next_cursor": next_cursor,
            },
            event=event,
        )


def _create_feedback(event: Mapping[str, Any]) -> dict[str, Any]:
    """Create an organization feedback entry."""
    body = _parse_body(event)

    organization_id = _require_org_id(body)
    stars = _parse_feedback_stars(body.get("stars"))
    label_ids = _parse_label_ids(body.get("label_ids"))
    description = _validate_string_length(
        body.get("description"),
        "description",
        MAX_DESCRIPTION_LENGTH,
        required=False,
    )
    submitter_id = _validate_string_length(
        body.get("submitter_id"),
        "submitter_id",
        MAX_NAME_LENGTH,
        required=False,
    )
    submitter_email = _validate_email(body.get("submitter_email"))
    source_ticket_id = _validate_string_length(
        body.get("source_ticket_id"),
        "source_ticket_id",
        MAX_NAME_LENGTH,
        required=False,
    )

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        org_repo = OrganizationRepository(session)
        label_repo = FeedbackLabelRepository(session)
        repo = OrganizationFeedbackRepository(session)

        _ensure_organization(org_repo, organization_id)
        _validate_feedback_labels(label_repo, label_ids)
        entity = OrganizationFeedback(
            organization_id=str(organization_id),
            submitter_id=submitter_id,
            submitter_email=submitter_email,
            stars=stars,
            label_ids=[str(label_id) for label_id in label_ids],
            description=description,
            source_ticket_id=source_ticket_id,
        )
        repo.create(entity)
        session.commit()
        session.refresh(entity)

    if submitter_id:
        _safe_adjust_feedback_stars(
            submitter_id,
            _feedback_stars_per_approval(),
        )

    return json_response(201, _serialize_feedback(entity), event=event)


def _update_feedback(
    event: Mapping[str, Any],
    feedback_id: str,
) -> dict[str, Any]:
    """Update an existing feedback entry."""
    body = _parse_body(event)

    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = OrganizationFeedbackRepository(session)
        label_repo = FeedbackLabelRepository(session)
        org_repo = OrganizationRepository(session)

        entity = repo.get_by_id(_parse_uuid(feedback_id))
        if entity is None:
            raise NotFoundError("organization_feedback", feedback_id)

        old_submitter_id = entity.submitter_id
        if "organization_id" in body:
            organization_id = _require_org_id(body)
            _ensure_organization(org_repo, organization_id)
            entity.organization_id = str(organization_id)
        if "stars" in body:
            entity.stars = _parse_feedback_stars(body.get("stars"))
        if "label_ids" in body:
            label_ids = _parse_label_ids(body.get("label_ids"))
            _validate_feedback_labels(label_repo, label_ids)
            entity.label_ids = [str(label_id) for label_id in label_ids]
        if "description" in body:
            entity.description = _validate_string_length(
                body.get("description"),
                "description",
                MAX_DESCRIPTION_LENGTH,
                required=False,
            )
        if "source_ticket_id" in body:
            entity.source_ticket_id = _validate_string_length(
                body.get("source_ticket_id"),
                "source_ticket_id",
                MAX_NAME_LENGTH,
                required=False,
            )
        if "submitter_id" in body:
            entity.submitter_id = _validate_string_length(
                body.get("submitter_id"),
                "submitter_id",
                MAX_NAME_LENGTH,
                required=False,
            )
        if "submitter_email" in body:
            entity.submitter_email = _validate_email(body.get("submitter_email"))

        repo.update(entity)
        session.commit()
        session.refresh(entity)

    if old_submitter_id != entity.submitter_id:
        delta = _feedback_stars_per_approval()
        if old_submitter_id:
            _safe_adjust_feedback_stars(old_submitter_id, -delta)
        if entity.submitter_id:
            _safe_adjust_feedback_stars(entity.submitter_id, delta)

    return json_response(200, _serialize_feedback(entity), event=event)


def _delete_feedback(
    event: Mapping[str, Any],
    feedback_id: str,
) -> dict[str, Any]:
    """Delete a feedback entry."""
    submitter_id: Optional[str] = None
    with Session(get_engine()) as session:
        _set_session_audit_context(session, event)
        repo = OrganizationFeedbackRepository(session)
        entity = repo.get_by_id(_parse_uuid(feedback_id))
        if entity is None:
            raise NotFoundError("organization_feedback", feedback_id)
        submitter_id = entity.submitter_id
        repo.delete(entity)
        session.commit()

    if submitter_id:
        _safe_adjust_feedback_stars(
            submitter_id,
            -_feedback_stars_per_approval(),
        )

    return json_response(204, {}, event=event)


def _serialize_feedback(entity: OrganizationFeedback) -> dict[str, Any]:
    """Serialize an organization feedback record."""
    organization_name = None
    if entity.organization:
        organization_name = entity.organization.name
    return {
        "id": str(entity.id),
        "organization_id": str(entity.organization_id),
        "organization_name": organization_name,
        "submitter_id": entity.submitter_id,
        "submitter_email": entity.submitter_email,
        "stars": entity.stars,
        "label_ids": [str(label_id) for label_id in (entity.label_ids or [])],
        "description": entity.description,
        "source_ticket_id": entity.source_ticket_id,
        "created_at": entity.created_at.isoformat() if entity.created_at else None,
        "updated_at": entity.updated_at.isoformat() if entity.updated_at else None,
    }


def _parse_feedback_stars(value: Any) -> int:
    """Parse feedback stars from request payload."""
    try:
        stars = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("stars must be an integer", field="stars") from exc
    if stars < 0 or stars > 5:
        raise ValidationError("stars must be between 0 and 5", field="stars")
    return stars


def _parse_label_ids(value: Any) -> list[UUID]:
    """Normalize feedback label IDs."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError("label_ids must be a list", field="label_ids")
    ids: list[UUID] = []
    seen: set[str] = set()
    for item in value:
        parsed = _parse_uuid(str(item))
        key = str(parsed)
        if key in seen:
            continue
        seen.add(key)
        ids.append(parsed)
    if len(ids) > MAX_FEEDBACK_LABELS_COUNT:
        raise ValidationError(
            f"label_ids cannot exceed {MAX_FEEDBACK_LABELS_COUNT} items",
            field="label_ids",
        )
    return ids


def _validate_feedback_labels(
    repo: FeedbackLabelRepository,
    label_ids: list[UUID],
) -> None:
    """Validate that feedback labels exist."""
    if not label_ids:
        return None
    labels = list(repo.get_by_ids(label_ids))
    if len(labels) != len(label_ids):
        raise ValidationError("One or more labels do not exist", field="label_ids")
    return None


def _require_org_id(body: dict[str, Any]) -> UUID:
    """Parse and require an organization_id."""
    org_id_raw = body.get("organization_id")
    if not org_id_raw:
        raise ValidationError("organization_id is required", field="organization_id")
    return _parse_uuid(org_id_raw)


def _ensure_organization(repo: OrganizationRepository, org_id: UUID) -> None:
    """Raise if organization does not exist."""
    if repo.get_by_id(org_id) is None:
        raise NotFoundError("organization", str(org_id))


def _safe_adjust_feedback_stars(user_sub: str, delta: int) -> None:
    """Adjust feedback stars without failing the request."""
    try:
        _adjust_user_feedback_stars(user_sub, delta)
    except Exception as exc:
        logger.error(
            "Failed to update feedback stars",
            extra={"user_sub": user_sub, "error": type(exc).__name__},
        )


def _feedback_stars_per_approval() -> int:
    """Return star increment configured for approvals."""
    raw = os.getenv("FEEDBACK_STARS_PER_APPROVAL", "1")
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        parsed = 1
    return max(0, parsed)
