"""Email templates for access request notifications.

This module contains templates for emails sent via Amazon SES.
Templates are defined as functions that return subject, text body, and HTML body.

To customize templates:
1. Modify the HTML/text content in the respective functions
2. Available variables are passed as function parameters
3. HTML templates use inline CSS for email client compatibility
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class EmailContent:
    """Container for email content."""

    subject: str
    body_text: str
    body_html: str


# =============================================================================
# NEW ACCESS REQUEST EMAIL (sent to support/admin)
# =============================================================================

NEW_REQUEST_SUBJECT = (
    "[Siu Tin Dei] [{ticket_id}] New Access Request: {organization_name}"
)

NEW_REQUEST_TEXT = """
[Siu Tin Dei] Access Request [{ticket_id}]

A new organization access request has been submitted.

Ticket ID: {ticket_id}
Requester Email: {requester_email}
Organization Name: {organization_name}
Request Message: {request_message}
Submitted At: {submitted_at}

Please review this request in the admin dashboard.
"""

NEW_REQUEST_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; color: #1a1a1a;">[Siu Tin Dei] Access Request</h2>
        <p style="margin: 0; font-size: 14px; color: #666;">
            Ticket ID: <strong style="font-family: monospace;">{ticket_id}</strong>
        </p>
    </div>

    <p style="margin-bottom: 20px;">A new organization access request has been submitted and requires your review.</p>

    <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa; width: 140px;">
                Ticket ID
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-family: monospace;">
                <strong>{ticket_id}</strong>
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Requester Email
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                <a href="mailto:{requester_email}" style="color: #0066cc;">{requester_email}</a>
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Organization Name
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {organization_name}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Request Message
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {request_message}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Submitted At
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {submitted_at}
            </td>
        </tr>
    </table>

    <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; border-left: 4px solid #0066cc;">
        <p style="margin: 0; font-size: 14px;">
            Please review this request in the admin dashboard and take appropriate action.
        </p>
    </div>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

    <p style="font-size: 12px; color: #666; margin: 0;">
        This is an automated message from Siu Tin Dei. Please do not reply directly to this email.
    </p>
</body>
</html>
"""


def render_new_request_email(
    ticket_id: str,
    requester_email: str,
    organization_name: str,
    request_message: Optional[str],
    submitted_at: str,
) -> EmailContent:
    """Render the new access request notification email.

    This email is sent to the support/admin team when a new access request
    is submitted by a manager.

    Args:
        ticket_id: Unique ticket identifier (e.g., HK1234567890)
        requester_email: Email address of the person making the request
        organization_name: Name of the organization they want to join/create
        request_message: Optional message from the requester
        submitted_at: ISO format timestamp of when the request was submitted

    Returns:
        EmailContent with subject, text body, and HTML body
    """
    message = request_message or "No message provided"

    subject = NEW_REQUEST_SUBJECT.format(
        ticket_id=ticket_id,
        organization_name=organization_name,
    )

    body_text = NEW_REQUEST_TEXT.format(
        ticket_id=ticket_id,
        requester_email=requester_email,
        organization_name=organization_name,
        request_message=message,
        submitted_at=submitted_at,
    )

    body_html = NEW_REQUEST_HTML.format(
        ticket_id=ticket_id,
        requester_email=requester_email,
        organization_name=organization_name,
        request_message=message,
        submitted_at=submitted_at,
    )

    return EmailContent(
        subject=subject,
        body_text=body_text,
        body_html=body_html,
    )


# =============================================================================
# REQUEST DECISION EMAIL (sent to requester on approval/rejection)
# =============================================================================

DECISION_APPROVED_SUBJECT = (
    "[Siu Tin Dei] [{ticket_id}] Your Access Request Has Been Approved"
)
DECISION_REJECTED_SUBJECT = (
    "[Siu Tin Dei] [{ticket_id}] Your Access Request Has Been Declined"
)

DECISION_TEXT = """
[Siu Tin Dei] Access Request Update [{ticket_id}]

Your organization access request has been reviewed.

Status: {status_text}

Ticket ID: {ticket_id}
Organization Name: {organization_name}
Reviewed At: {reviewed_at}{admin_message_section}

{status_message}

If you have any questions, please contact support.
"""

DECISION_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; color: #1a1a1a;">[Siu Tin Dei] Access Request Update</h2>
        <p style="margin: 0; font-size: 14px; color: #666;">
            Ticket ID: <strong style="font-family: monospace;">{ticket_id}</strong>
        </p>
    </div>

    <div style="padding: 20px; background-color: {status_color}; color: white; text-align: center; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0; font-size: 24px;">Request {status_text}</h3>
    </div>

    <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa; width: 140px;">
                Ticket ID
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-family: monospace;">
                <strong>{ticket_id}</strong>
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Organization Name
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {organization_name}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Reviewed At
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {reviewed_at}
            </td>
        </tr>
        {admin_message_row}
    </table>

    <div style="background-color: {message_bg_color}; padding: 15px; border-radius: 5px; border-left: 4px solid {status_color}; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px;">
            {status_message}
        </p>
    </div>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

    <p style="font-size: 12px; color: #666; margin: 0;">
        If you have any questions, please contact support. This is an automated message from Siu Tin Dei.
    </p>
</body>
</html>
"""

# =============================================================================
# NEW ORGANIZATION SUGGESTION EMAIL (sent to support/admin)
# =============================================================================

NEW_SUGGESTION_SUBJECT = (
    "[Siu Tin Dei] [{ticket_id}] New Organization Suggestion: {organization_name}"
)

NEW_SUGGESTION_TEXT = """
[Siu Tin Dei] Organization Suggestion [{ticket_id}]

A new organization suggestion has been submitted by a user.

Ticket ID: {ticket_id}
Suggester Email: {suggester_email}
Organization Name: {organization_name}
Description: {description}
District: {district}
Address: {address}
Additional Notes: {additional_notes}
Submitted At: {submitted_at}

Please review this suggestion in the admin dashboard.
"""

NEW_SUGGESTION_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; color: #1a1a1a;">[Siu Tin Dei] Organization Suggestion</h2>
        <p style="margin: 0; font-size: 14px; color: #666;">
            Ticket ID: <strong style="font-family: monospace;">{ticket_id}</strong>
        </p>
    </div>

    <p style="margin-bottom: 20px;">A user has suggested a new organization/place for the platform.</p>

    <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa; width: 140px;">
                Ticket ID
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-family: monospace;">
                <strong>{ticket_id}</strong>
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Suggester Email
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                <a href="mailto:{suggester_email}" style="color: #0066cc;">{suggester_email}</a>
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Organization Name
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {organization_name}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Description
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {description}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                District
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {district}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Address
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {address}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Additional Notes
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {additional_notes}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Submitted At
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {submitted_at}
            </td>
        </tr>
    </table>

    <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; border-left: 4px solid #0066cc;">
        <p style="margin: 0; font-size: 14px;">
            Please review this suggestion in the admin dashboard and approve or reject it.
        </p>
    </div>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

    <p style="font-size: 12px; color: #666; margin: 0;">
        This is an automated message from Siu Tin Dei. Please do not reply directly to this email.
    </p>
</body>
</html>
"""


def render_new_suggestion_email(
    ticket_id: str,
    suggester_email: str,
    organization_name: str,
    description: Optional[str],
    district: Optional[str],
    address: Optional[str],
    additional_notes: Optional[str],
    submitted_at: str,
) -> EmailContent:
    """Render the new organization suggestion notification email.

    This email is sent to the support/admin team when a user submits
    a new organization suggestion.

    Args:
        ticket_id: Unique ticket identifier (e.g., S00001)
        suggester_email: Email address of the person who suggested
        organization_name: Suggested organization name
        description: Optional description of the place
        district: Optional district/area
        address: Optional address
        additional_notes: Optional notes from the suggester
        submitted_at: ISO format timestamp of submission

    Returns:
        EmailContent with subject, text body, and HTML body
    """
    desc = description or "Not provided"
    dist = district or "Not provided"
    addr = address or "Not provided"
    notes = additional_notes or "None"

    subject = NEW_SUGGESTION_SUBJECT.format(
        ticket_id=ticket_id,
        organization_name=organization_name,
    )

    body_text = NEW_SUGGESTION_TEXT.format(
        ticket_id=ticket_id,
        suggester_email=suggester_email,
        organization_name=organization_name,
        description=desc,
        district=dist,
        address=addr,
        additional_notes=notes,
        submitted_at=submitted_at,
    )

    body_html = NEW_SUGGESTION_HTML.format(
        ticket_id=ticket_id,
        suggester_email=suggester_email,
        organization_name=organization_name,
        description=desc,
        district=dist,
        address=addr,
        additional_notes=notes,
        submitted_at=submitted_at,
    )

    return EmailContent(
        subject=subject,
        body_text=body_text,
        body_html=body_html,
    )


ADMIN_MESSAGE_ROW_HTML = """
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Admin Message
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {admin_message}
            </td>
        </tr>
"""


def render_request_decision_email(
    ticket_id: str,
    organization_name: str,
    reviewed_at: str,
    action: str,
    admin_message: Optional[str] = None,
) -> EmailContent:
    """Render the request decision notification email.

    This email is sent to the requester when their access request is
    approved or rejected by an admin.

    Args:
        ticket_id: Unique ticket identifier (e.g., HK1234567890)
        organization_name: Name of the organization they requested
        reviewed_at: ISO format timestamp of when the request was reviewed
        action: Either 'approve' or 'reject'
        admin_message: Optional message from the admin to the requester

    Returns:
        EmailContent with subject, text body, and HTML body
    """
    is_approved = action == "approve"

    if is_approved:
        subject = DECISION_APPROVED_SUBJECT.format(ticket_id=ticket_id)
        status_text = "APPROVED"
        status_color = "#28a745"
        message_bg_color = "#d4edda"
        status_message = (
            "Congratulations! Your organization access request has been approved. "
            "You can now log in to the admin system and manage your organization."
        )
    else:
        subject = DECISION_REJECTED_SUBJECT.format(ticket_id=ticket_id)
        status_text = "DECLINED"
        status_color = "#dc3545"
        message_bg_color = "#f8d7da"
        status_message = (
            "We regret to inform you that your organization access request has been declined. "
            "If you believe this was a mistake, please contact support for more information."
        )

    # Handle admin message for text version
    if admin_message:
        admin_message_section_text = f"\nAdmin Message: {admin_message}"
    else:
        admin_message_section_text = ""

    # Handle admin message for HTML version
    if admin_message:
        admin_message_row = ADMIN_MESSAGE_ROW_HTML.format(admin_message=admin_message)
    else:
        admin_message_row = ""

    body_text = DECISION_TEXT.format(
        ticket_id=ticket_id,
        status_text=status_text,
        organization_name=organization_name,
        reviewed_at=reviewed_at,
        admin_message_section=admin_message_section_text,
        status_message=status_message,
    )

    body_html = DECISION_HTML.format(
        ticket_id=ticket_id,
        status_text=status_text,
        status_color=status_color,
        message_bg_color=message_bg_color,
        organization_name=organization_name,
        reviewed_at=reviewed_at,
        admin_message_row=admin_message_row,
        status_message=status_message,
    )

    return EmailContent(
        subject=subject,
        body_text=body_text,
        body_html=body_html,
    )
