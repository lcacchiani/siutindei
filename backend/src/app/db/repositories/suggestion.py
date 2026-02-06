"""Repository for organization suggestions.

This module provides data access methods for organization suggestions
submitted by public users.
"""

from __future__ import annotations

from typing import Optional
from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import OrganizationSuggestion, SuggestionStatus
from app.db.repositories.base import BaseRepository


class OrganizationSuggestionRepository(BaseRepository[OrganizationSuggestion]):
    """Repository for organization suggestion operations."""

    def __init__(self, session: Session):
        """Initialize the repository.

        Args:
            session: SQLAlchemy session for database operations.
        """
        super().__init__(session, OrganizationSuggestion)

    def find_by_suggester(
        self,
        suggester_id: str,
        limit: int = 50,
        cursor: Optional[UUID] = None,
    ) -> Sequence[OrganizationSuggestion]:
        """Find suggestions by suggester.

        Args:
            suggester_id: Cognito user sub of the suggester.
            limit: Maximum number of results.
            cursor: Pagination cursor.

        Returns:
            Sequence of suggestions by this user.
        """
        query = (
            select(OrganizationSuggestion)
            .where(OrganizationSuggestion.suggester_id == suggester_id)
            .order_by(OrganizationSuggestion.created_at.desc())
        )
        if cursor:
            query = query.where(OrganizationSuggestion.id > cursor)
        return self._session.execute(query.limit(limit)).scalars().all()

    def find_pending_by_suggester(
        self,
        suggester_id: str,
    ) -> Optional[OrganizationSuggestion]:
        """Find a pending suggestion by suggester.

        Args:
            suggester_id: Cognito user sub of the suggester.

        Returns:
            The pending suggestion if found.
        """
        query = (
            select(OrganizationSuggestion)
            .where(OrganizationSuggestion.suggester_id == suggester_id)
            .where(OrganizationSuggestion.status == SuggestionStatus.PENDING)
            .order_by(OrganizationSuggestion.created_at.desc())
            .limit(1)
        )
        return self._session.execute(query).scalar_one_or_none()

    def find_all(
        self,
        status: Optional[SuggestionStatus] = None,
        limit: int = 50,
        cursor: Optional[UUID] = None,
    ) -> Sequence[OrganizationSuggestion]:
        """Find all suggestions with optional status filter.

        Args:
            status: Filter by suggestion status.
            limit: Maximum number of results.
            cursor: Pagination cursor.

        Returns:
            Sequence of suggestions.
        """
        query = select(OrganizationSuggestion).order_by(
            OrganizationSuggestion.created_at.desc()
        )
        if status:
            query = query.where(OrganizationSuggestion.status == status)
        if cursor:
            query = query.where(OrganizationSuggestion.id > cursor)
        return self._session.execute(query.limit(limit)).scalars().all()

    def count_pending(self) -> int:
        """Count pending suggestions.

        Returns:
            Number of pending suggestions.
        """
        from sqlalchemy import func

        query = (
            select(func.count())
            .select_from(OrganizationSuggestion)
            .where(OrganizationSuggestion.status == SuggestionStatus.PENDING)
        )
        return self._session.execute(query).scalar() or 0
