"""Template types for email rendering."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EmailContent:
    """Container for email content."""

    subject: str
    body_text: str
    body_html: str
