'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  listOrganizationSuggestions,
  reviewOrganizationSuggestion,
  type ReviewSuggestionPayload,
} from '../../lib/api-client';
import type { OrganizationSuggestion } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface ReviewModalProps {
  suggestion: OrganizationSuggestion;
  onClose: () => void;
  onReviewed: (updated: OrganizationSuggestion) => void;
}

function ReviewModal({ suggestion, onClose, onReviewed }: ReviewModalProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [createOrg, setCreateOrg] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const payload: ReviewSuggestionPayload = {
        action,
        admin_notes: adminNotes.trim() || undefined,
      };

      if (action === 'approve') {
        payload.create_organization = createOrg;
      }

      const response = await reviewOrganizationSuggestion(suggestion.id, payload);
      onReviewed(response.suggestion);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : 'Failed to process suggestion';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4'>
      <div className='max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-xl sm:p-6'>
        <h3 className='mb-4 text-base font-semibold sm:text-lg'>
          Review Suggestion: <span className='break-all'>{suggestion.ticket_id}</span>
        </h3>

        {error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {error}
            </StatusBanner>
          </div>
        )}

        <div className='mb-4 space-y-2 text-sm'>
          <p>
            <span className='font-medium'>Suggested Name:</span>{' '}
            {suggestion.organization_name}
          </p>
          <p className='break-all'>
            <span className='font-medium'>Submitted by:</span>{' '}
            {suggestion.suggester_email}
          </p>
          {suggestion.description && (
            <p>
              <span className='font-medium'>Description:</span>{' '}
              {suggestion.description}
            </p>
          )}
          {suggestion.suggested_district && (
            <p>
              <span className='font-medium'>District:</span>{' '}
              {suggestion.suggested_district}
            </p>
          )}
          {suggestion.suggested_address && (
            <p>
              <span className='font-medium'>Address:</span>{' '}
              {suggestion.suggested_address}
            </p>
          )}
          {suggestion.suggested_lat && suggestion.suggested_lng && (
            <p>
              <span className='font-medium'>Coordinates:</span>{' '}
              {suggestion.suggested_lat}, {suggestion.suggested_lng}
            </p>
          )}
          {suggestion.additional_notes && (
            <p>
              <span className='font-medium'>Notes:</span>{' '}
              {suggestion.additional_notes}
            </p>
          )}
          {suggestion.media_urls && suggestion.media_urls.length > 0 && (
            <div>
              <span className='font-medium'>Media:</span>{' '}
              <span className='text-slate-500'>
                {suggestion.media_urls.length} file(s)
              </span>
            </div>
          )}
        </div>

        <div className='mb-4'>
          <Label htmlFor='review-action'>Action</Label>
          <Select
            id='review-action'
            value={action}
            onChange={(e) => setAction(e.target.value as 'approve' | 'reject')}
          >
            <option value='approve'>Approve</option>
            <option value='reject'>Reject</option>
          </Select>
        </div>

        {action === 'approve' && (
          <div className='mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3'>
            <label className='flex items-center gap-2'>
              <input
                type='checkbox'
                checked={createOrg}
                onChange={(e) => setCreateOrg(e.target.checked)}
                className='h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500'
              />
              <span className='text-sm'>Create organization from this suggestion</span>
            </label>
            {createOrg && (
              <p className='text-xs text-slate-500'>
                A new organization will be created with the suggested name and details.
              </p>
            )}
          </div>
        )}

        <div className='mb-4'>
          <Label htmlFor='admin-notes'>Admin Notes (Optional)</Label>
          <Textarea
            id='admin-notes'
            rows={3}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder='Add notes about your decision...'
          />
        </div>

        <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3'>
          <Button
            type='button'
            variant='secondary'
            onClick={onClose}
            disabled={isSubmitting}
            className='w-full sm:w-auto'
          >
            Cancel
          </Button>
          <Button
            type='button'
            variant={action === 'approve' ? 'primary' : 'danger'}
            onClick={handleSubmit}
            disabled={isSubmitting}
            className='w-full sm:w-auto'
          >
            {isSubmitting
              ? 'Processing...'
              : action === 'approve'
                ? 'Approve Suggestion'
                : 'Reject Suggestion'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function StatusBadge({ status }: { status: OrganizationSuggestion['status'] }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function OrganizationSuggestionsPanel() {
  const [items, setItems] = useState<OrganizationSuggestion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [reviewingSuggestion, setReviewingSuggestion] =
    useState<OrganizationSuggestion | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const loadItems = async (cursor?: string, reset = false) => {
    setIsLoading(true);
    setError('');
    try {
      const filterStatus = statusFilter === 'all' ? undefined : statusFilter;
      const response = await listOrganizationSuggestions(filterStatus, cursor);
      setItems((prev) =>
        reset || !cursor ? response.items : [...prev, ...response.items]
      );
      setNextCursor(response.next_cursor ?? null);
      setPendingCount(response.pending_count);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load organization suggestions.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleReviewed = (updated: OrganizationSuggestion) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setReviewingSuggestion(null);
    // Reload to update pending count
    loadItems(undefined, true);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter items based on search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.ticket_id?.toLowerCase().includes(query) ||
      item.organization_name?.toLowerCase().includes(query) ||
      item.suggester_email?.toLowerCase().includes(query) ||
      item.suggested_district?.toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query)
    );
  });

  return (
    <div className='space-y-6'>
      <Card
        title='Organization Suggestions'
        description='Review organization suggestions submitted by users.'
      >
        {pendingCount > 0 && (
          <div className='mb-4'>
            <StatusBanner variant='info' title='Pending Review'>
              {pendingCount} suggestion{pendingCount !== 1 ? 's' : ''} awaiting review.
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

        <div className='mb-4'>
          <Label htmlFor='status-filter'>Filter by Status</Label>
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

        {isLoading && items.length === 0 ? (
          <p className='text-sm text-slate-600'>Loading suggestions...</p>
        ) : items.length === 0 ? (
          <p className='text-sm text-slate-600'>
            No {statusFilter !== 'all' ? statusFilter : ''} suggestions found.
          </p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search suggestions...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredItems.length === 0 ? (
              <p className='text-sm text-slate-600'>
                No suggestions match your search.
              </p>
            ) : (
              <>
                {/* Desktop table view */}
                <div className='hidden overflow-x-auto md:block'>
                  <table className='w-full text-left text-sm'>
                    <thead className='border-b border-slate-200 text-slate-500'>
                      <tr>
                        <th className='py-2'>Ticket ID</th>
                        <th className='py-2'>Organization Name</th>
                        <th className='py-2'>District</th>
                        <th className='py-2'>Submitted By</th>
                        <th className='py-2'>Status</th>
                        <th className='py-2'>Submitted</th>
                        <th className='py-2 text-right'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr key={item.id} className='border-b border-slate-100'>
                          <td className='py-2'>{item.ticket_id}</td>
                          <td className='max-w-[200px] truncate py-2 font-medium'>
                            {item.organization_name}
                          </td>
                          <td className='py-2 text-slate-600'>
                            {item.suggested_district || '—'}
                          </td>
                          <td className='max-w-[180px] truncate py-2 text-slate-600'>
                            {item.suggester_email}
                          </td>
                          <td className='py-2'>
                            <StatusBadge status={item.status} />
                          </td>
                          <td className='py-2 text-slate-600'>
                            {formatDate(item.created_at)}
                          </td>
                          <td className='py-2 text-right'>
                            {item.status === 'pending' ? (
                              <Button
                                type='button'
                                size='sm'
                                variant='ghost'
                                onClick={() => setReviewingSuggestion(item)}
                                aria-label='Review suggestion'
                              >
                                <ReviewIcon className='h-4 w-4' />
                              </Button>
                            ) : (
                              <span className='text-xs text-slate-400'>
                                {item.reviewed_at
                                  ? `Reviewed ${formatDate(item.reviewed_at)}`
                                  : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card view */}
                <div className='space-y-3 md:hidden'>
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <div className='font-medium text-slate-900'>
                            {item.organization_name}
                          </div>
                          <div className='mt-0.5 text-sm text-slate-500'>
                            {item.ticket_id}
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className='mt-2 space-y-1 text-sm'>
                        {item.suggested_district && (
                          <div className='text-slate-600'>
                            District: {item.suggested_district}
                          </div>
                        )}
                        <div className='truncate text-slate-600'>
                          {item.suggester_email}
                        </div>
                        <div className='text-slate-500'>
                          Submitted: {formatDate(item.created_at)}
                        </div>
                      </div>
                      <div className='mt-3 border-t border-slate-200 pt-3'>
                        {item.status === 'pending' ? (
                          <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            onClick={() => setReviewingSuggestion(item)}
                            className='w-full'
                            aria-label='Review suggestion'
                          >
                            <ReviewIcon className='h-4 w-4' />
                          </Button>
                        ) : (
                          <span className='block text-center text-xs text-slate-400'>
                            {item.reviewed_at
                              ? `Reviewed ${formatDate(item.reviewed_at)}`
                              : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {nextCursor && (
                  <div className='mt-4'>
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={() => loadItems(nextCursor)}
                      disabled={isLoading}
                      className='w-full sm:w-auto'
                    >
                      {isLoading ? 'Loading...' : 'Load more'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {reviewingSuggestion && (
        <ReviewModal
          suggestion={reviewingSuggestion}
          onClose={() => setReviewingSuggestion(null)}
          onReviewed={handleReviewed}
        />
      )}
    </div>
  );
}
