"""Repository for OrganizationAccessRequest entities."""

from __future__ import annotations

from typing import Optional
from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AccessRequestStatus, OrganizationAccessRequest
from app.db.repositories.base import BaseRepository


class OrganizationAccessRequestRepository(BaseRepository[OrganizationAccessRequest]):
    """Repository for OrganizationAccessRequest CRUD operations."""

    def __init__(self, session: Session):
        """Initialize the repository.

        Args:
            session: SQLAlchemy session for database operations.
        """
        super().__init__(session, OrganizationAccessRequest)

    def find_by_ticket_id(
        self,
        ticket_id: str,
    ) -> Optional[OrganizationAccessRequest]:
        """Find a request by its ticket ID.

        Used for idempotency checks in async processing to avoid
        creating duplicate requests.

        Args:
            ticket_id: The unique ticket ID (e.g., R00001).

        Returns:
            The request if found, None otherwise.
        """
        query = select(OrganizationAccessRequest).where(
            OrganizationAccessRequest.ticket_id == ticket_id
        )
        return self._session.execute(query).scalar_one_or_none()

    def find_pending_by_requester(
        self,
        requester_id: str,
    ) -> Optional[OrganizationAccessRequest]:
        """Find a pending request for a specific user.

        Args:
            requester_id: The Cognito user sub (subject) identifier.

        Returns:
            The pending request if found, None otherwise.
        """
        query = select(OrganizationAccessRequest).where(
            OrganizationAccessRequest.requester_id == requester_id,
            OrganizationAccessRequest.status == AccessRequestStatus.PENDING,
        )
        return self._session.execute(query).scalar_one_or_none()

    def find_by_requester(
        self,
        requester_id: str,
        limit: int = 50,
    ) -> Sequence[OrganizationAccessRequest]:
        """Find all requests for a specific user.

        Args:
            requester_id: The Cognito user sub (subject) identifier.
            limit: Maximum results to return.

        Returns:
            Requests by the specified user.
        """
        query = (
            select(OrganizationAccessRequest)
            .where(OrganizationAccessRequest.requester_id == requester_id)
            .order_by(OrganizationAccessRequest.created_at.desc())
            .limit(limit)
        )
        return self._session.execute(query).scalars().all()

    def find_pending(
        self,
        limit: int = 50,
        cursor: Optional[UUID] = None,
    ) -> Sequence[OrganizationAccessRequest]:
        """Find all pending requests.

        Args:
            limit: Maximum results to return.
            cursor: Optional cursor for pagination.

        Returns:
            Pending requests ordered by creation date.
        """
        query = (
            select(OrganizationAccessRequest)
            .where(OrganizationAccessRequest.status == AccessRequestStatus.PENDING)
            .order_by(OrganizationAccessRequest.created_at.desc())
        )
        if cursor:
            query = query.where(OrganizationAccessRequest.id < cursor)
        query = query.limit(limit)
        return self._session.execute(query).scalars().all()

    def has_pending_request(self, requester_id: str) -> bool:
        """Check if a user has a pending request.

        Args:
            requester_id: The Cognito user sub (subject) identifier.

        Returns:
            True if the user has a pending request, False otherwise.
        """
        return self.find_pending_by_requester(requester_id) is not None

    def find_all(
        self,
        status: Optional[AccessRequestStatus] = None,
        limit: int = 50,
        cursor: Optional[UUID] = None,
    ) -> Sequence[OrganizationAccessRequest]:
        """Find all requests with optional status filter.

        Args:
            status: Optional status filter.
            limit: Maximum results to return.
            cursor: Optional cursor for pagination.

        Returns:
            Requests ordered by creation date (newest first).
        """
        query = select(OrganizationAccessRequest).order_by(
            OrganizationAccessRequest.created_at.desc()
        )
        if status:
            query = query.where(OrganizationAccessRequest.status == status)
        if cursor:
            query = query.where(OrganizationAccessRequest.id < cursor)
        query = query.limit(limit)
        return self._session.execute(query).scalars().all()
