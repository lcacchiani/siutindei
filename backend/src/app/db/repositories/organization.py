"""Repository for Organization entities."""

from __future__ import annotations

from typing import Optional
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Organization
from app.db.repositories.base import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    """Repository for Organization CRUD operations."""

    def __init__(self, session: Session):
        """Initialize the repository.

        Args:
            session: SQLAlchemy session for database operations.
        """
        super().__init__(session, Organization)

    def find_by_name(self, name: str) -> Optional[Organization]:
        """Find an organization by exact name.

        Args:
            name: The organization name.

        Returns:
            The organization if found, None otherwise.
        """
        query = select(Organization).where(Organization.name == name)
        return self._session.execute(query).scalar_one_or_none()

    def search_by_name(
        self,
        name_pattern: str,
        limit: int = 50,
    ) -> Sequence[Organization]:
        """Search organizations by name pattern (case-insensitive).

        Args:
            name_pattern: Pattern to search for.
            limit: Maximum results to return.

        Returns:
            Matching organizations.
        """
        # Escape LIKE special characters to prevent pattern injection
        escaped = _escape_like_pattern(name_pattern)
        query = (
            select(Organization)
            .where(Organization.name.ilike(f"%{escaped}%"))
            .order_by(Organization.name)
            .limit(limit)
        )
        return self._session.execute(query).scalars().all()


def _escape_like_pattern(pattern: str) -> str:
    """Escape LIKE pattern special characters.

    Prevents users from injecting wildcards into search patterns.

    Args:
        pattern: The search pattern to escape.

    Returns:
        The escaped pattern safe for use in LIKE queries.
    """
    # Escape backslash first, then percent and underscore
    return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    def create_organization(
        self,
        name: str,
        description: Optional[str] = None,
        picture_urls: Optional[Sequence[str]] = None,
    ) -> Organization:
        """Create a new organization.

        Args:
            name: Organization name.
            description: Optional description.
            picture_urls: Optional list of picture URLs.

        Returns:
            The created organization.
        """
        org = Organization(
            name=name,
            description=description,
            picture_urls=list(picture_urls or []),
        )
        return self.create(org)

    def update_organization(
        self,
        organization: Organization,
        name: Optional[str] = None,
        description: Optional[str] = None,
        picture_urls: Optional[Sequence[str]] = None,
    ) -> Organization:
        """Update an organization.

        Args:
            organization: The organization to update.
            name: New name (if provided).
            description: New description (if provided).
            picture_urls: New picture URLs (if provided).

        Returns:
            The updated organization.
        """
        if name is not None:
            organization.name = name
        if description is not None:
            organization.description = description
        if picture_urls is not None:
            organization.picture_urls = list(picture_urls)
        return self.update(organization)
