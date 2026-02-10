"""Email templates for the application."""

from app.templates.access_request import (
    build_new_request_template_data,
    render_new_request_email,
)
from app.templates.feedback import (
    build_new_feedback_template_data,
    render_new_feedback_email,
)
from app.templates.request_decision import (
    build_request_decision_template_data,
    render_request_decision_email,
)
from app.templates.suggestion import (
    build_new_suggestion_template_data,
    render_new_suggestion_email,
)
from app.templates.types import EmailContent

__all__ = [
    "EmailContent",
    "build_new_request_template_data",
    "build_new_feedback_template_data",
    "build_new_suggestion_template_data",
    "build_request_decision_template_data",
    "render_new_request_email",
    "render_new_feedback_email",
    "render_new_suggestion_email",
    "render_request_decision_email",
]
