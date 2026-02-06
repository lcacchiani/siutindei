"""Email templates for the application."""

from app.templates.email_templates import (
    render_new_request_email,
    render_new_suggestion_email,
    render_request_decision_email,
)

__all__ = [
    "render_new_request_email",
    "render_new_suggestion_email",
    "render_request_decision_email",
]
