'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  listResource,
} from '../../lib/api-client';
import { formatDateTime } from '../../lib/date-utils';
import {
  listTickets,
  type Ticket,
  type TicketStatus,
  type TicketType,
} from '../../lib/api-client-tickets';
import type { FeedbackLabel } from '../../types/admin';
import { ReviewIcon } from '../icons/action-icons';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBadge } from '../ui/status-badge';
import { StatusBanner } from '../status-banner';
import { ReviewModal, TicketTypeBadge } from './tickets/review-modal';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type TypeFilter =
  | 'all'
  | 'access_request'
  | 'organization_suggestion'
  | 'organization_feedback';

// --- Main Panel ---

export function TicketsPanel() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [reviewingTicket, setReviewingTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackLabels, setFeedbackLabels] = useState<FeedbackLabel[]>([]);

  const loadItems = useCallback(
    async (cursor?: string, reset = false) => {
      setIsLoading(true);
      setError('');
      try {
        const filterStatus =
          statusFilter === 'all' ? undefined : (statusFilter as TicketStatus);
        const filterType =
          typeFilter === 'all' ? undefined : (typeFilter as TicketType);
        const response = await listTickets(filterType, filterStatus, cursor);
        setItems((prev) =>
          reset || !cursor ? response.items : [...prev, ...response.items]
        );
        setNextCursor(response.next_cursor ?? null);
        setPendingCount(response.pending_count);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to load tickets.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, typeFilter]
  );

  useEffect(() => {
    void loadItems(undefined, true);
  }, [loadItems]);

  useEffect(() => {
    const loadLabels = async () => {
      try {
        const response = await listResource<FeedbackLabel>('feedback-labels');
        setFeedbackLabels(response.items);
      } catch {
        setFeedbackLabels([]);
      }
    };
    loadLabels();
  }, []);

  const handleReviewed = (updated: Ticket) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setReviewingTicket(null);
    void loadItems(undefined, true);
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.ticket_id?.toLowerCase().includes(query) ||
      item.organization_name?.toLowerCase().includes(query) ||
      item.submitter_email?.toLowerCase().includes(query) ||
      item.suggested_district?.toLowerCase().includes(query) ||
      item.feedback_text?.toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query)
    );
  });

  const labelNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const label of feedbackLabels) {
      map[label.id] = label.name;
    }
    return map;
  }, [feedbackLabels]);

  const columns = useMemo(
    () => [
      {
        key: 'ticket-id',
        header: 'Ticket ID',
        secondary: true,
        render: (item: Ticket) => (
          <span className='font-mono text-xs text-slate-600'>
            {item.ticket_id}
          </span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (item: Ticket) => <TicketTypeBadge type={item.ticket_type} />,
      },
      {
        key: 'organization',
        header: 'Organization',
        primary: true,
        render: (item: Ticket) => (
          <span className='font-medium'>{item.organization_name}</span>
        ),
      },
      {
        key: 'district',
        header: 'District',
        headerClassName: 'md:hidden',
        cellClassName: 'md:hidden',
        render: (item: Ticket) => (
          <span className='text-slate-600'>
            {item.suggested_district || '—'}
          </span>
        ),
      },
      {
        key: 'submitted-by',
        header: 'Submitted By',
        render: (item: Ticket) => (
          <span className='text-slate-600'>{item.submitter_email}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (item: Ticket) => <StatusBadge status={item.status} />,
      },
      {
        key: 'submitted',
        header: 'Submitted',
        render: (item: Ticket) => (
          <span className='text-slate-600'>{formatDateTime(item.created_at)}</span>
        ),
      },
    ],
    []
  );

  function renderActions(item: Ticket, context: 'desktop' | 'mobile') {
    if (item.status === 'pending') {
      return (
        <Button
          type='button'
          size='sm'
          variant='ghost'
          onClick={() => setReviewingTicket(item)}
          className={context === 'mobile' ? 'flex-1' : undefined}
          aria-label='Review ticket'
        >
          <ReviewIcon className='h-4 w-4' />
        </Button>
      );
    }
    const reviewedLabel = item.reviewed_at
      ? `Reviewed ${formatDateTime(item.reviewed_at)}`
      : '—';
    return (
      <span
        className={
          context === 'mobile'
            ? 'flex-1 text-center text-xs text-slate-400'
            : 'text-xs text-slate-400'
        }
      >
        {reviewedLabel}
      </span>
    );
  }

  return (
    <div className='space-y-6'>
      <Card
        title='Tickets'
        description='Review and manage submitted tickets.'
      >
        {pendingCount > 0 && (
          <div className='mb-4'>
            <StatusBanner variant='info' title='Pending Review'>
              {pendingCount} ticket{pendingCount !== 1 ? 's' : ''} awaiting review.
            </StatusBanner>
          </div>
        )}

        {error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}

        <div className='mb-4 flex flex-col gap-3 sm:flex-row'>
          <div className='flex-1'>
            <Label htmlFor='type-filter'>Type</Label>
            <Select
              id='type-filter'
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value='all'>All Types</option>
              <option value='access_request'>Access Requests</option>
              <option value='organization_suggestion'>Suggestions</option>
              <option value='organization_feedback'>Feedback</option>
            </Select>
          </div>
          <div className='flex-1'>
            <Label htmlFor='status-filter'>Status</Label>
            <Select
              id='status-filter'
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value='pending'>Pending</option>
              <option value='approved'>Approved</option>
              <option value='rejected'>Rejected</option>
              <option value='all'>All</option>
            </Select>
          </div>
        </div>

        {isLoading && items.length === 0 ? (
          <p className='text-sm text-slate-600'>Loading tickets...</p>
        ) : items.length === 0 ? (
          <p className='text-sm text-slate-600'>
            No {statusFilter !== 'all' ? statusFilter : ''} tickets found.
          </p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search tickets...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <DataTable
              columns={columns}
              data={filteredItems}
              keyExtractor={(item) => item.id}
              renderActions={renderActions}
              nextCursor={nextCursor}
              onLoadMore={() => loadItems(nextCursor ?? undefined)}
              isLoading={isLoading}
              emptyMessage='No tickets match your search.'
            />
          </div>
        )}
      </Card>

      {reviewingTicket && (
        <ReviewModal
          ticket={reviewingTicket}
          onClose={() => setReviewingTicket(null)}
          onReviewed={handleReviewed}
          labelNameById={labelNameById}
        />
      )}
    </div>
  );
}
