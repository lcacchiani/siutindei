"""Feedback label resource handlers."""

from __future__ import annotations

from typing import Any

from app.api.admin_validators import (
    MAX_NAME_LENGTH,
    _validate_string_length,
    _validate_translations_map,
)
from app.db.models import FeedbackLabel
from app.db.repositories import FeedbackLabelRepository
from app.exceptions import ValidationError
from app.utils.translations import build_translation_map


def _serialize_feedback_label(entity: FeedbackLabel) -> dict[str, Any]:
    """Serialize a feedback label."""
    return {
        "id": str(entity.id),
        "name": entity.name,
        "name_translations": build_translation_map(
            entity.name, entity.name_translations
        ),
        "display_order": entity.display_order,
    }


def _parse_display_order(value: Any) -> int:
    """Parse and validate display_order."""
    if value is None:
        return 0
    try:
        parsed = int(value)
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            "display_order must be a valid integer",
            field="display_order",
        ) from exc
    if parsed < 0:
        raise ValidationError(
            "display_order must be at least 0",
            field="display_order",
        )
    return parsed


def _create_feedback_label(
    repo: FeedbackLabelRepository,
    body: dict[str, Any],
) -> FeedbackLabel:
    """Create a feedback label."""
    name = _validate_string_length(
        body.get("name"),
        "name",
        MAX_NAME_LENGTH,
        required=True,
    )
    name_translations = _validate_translations_map(
        body.get("name_translations"),
        "name_translations",
        MAX_NAME_LENGTH,
    )
    display_order = _parse_display_order(body.get("display_order"))
    return FeedbackLabel(
        name=name,
        name_translations=name_translations,
        display_order=display_order,
    )


def _update_feedback_label(
    repo: FeedbackLabelRepository,
    entity: FeedbackLabel,
    body: dict[str, Any],
) -> FeedbackLabel:
    """Update a feedback label."""
    if "name" in body:
        name = _validate_string_length(
            body.get("name"),
            "name",
            MAX_NAME_LENGTH,
            required=True,
        )
        entity.name = name  # type: ignore[assignment]
    if "name_translations" in body:
        entity.name_translations = _validate_translations_map(
            body.get("name_translations"),
            "name_translations",
            MAX_NAME_LENGTH,
        )
    if "display_order" in body:
        entity.display_order = _parse_display_order(body.get("display_order"))
    return entity
