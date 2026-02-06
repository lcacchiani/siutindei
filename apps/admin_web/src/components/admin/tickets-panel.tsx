'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  listTickets,
  listCognitoUsers,
  listResource,
  reviewTicket,
  type Ticket,
  type TicketType,
  type TicketStatus,
  type ReviewTicketPayload,
} from '../../lib/api-client';
import type { CognitoUser, Organization } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type TypeFilter = 'all' | 'access_request' | 'organization_suggestion';

// --- Review Modal ---

interface ReviewModalProps {
  ticket: Ticket;
  onClose: () => void;
  onReviewed: (updated: Ticket) => void;
}

type OrganizationMode = 'existing' | 'new';

function ReviewModal({ ticket, onClose, onReviewed }: ReviewModalProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [createOrg, setCreateOrg] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Organization selection state (for access_request approval)
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [managerEmails, setManagerEmails] = useState<Record<string, string>>({});
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [organizationMode, setOrganizationMode] = useState<OrganizationMode>('new');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const isAccessRequest = ticket.ticket_type === 'access_request';

  // Load organizations for access request approval
  useEffect(() => {
    if (!isAccessRequest) return;
    const loadOrgs = async () => {
      setIsLoadingOrgs(true);
      try {
        const [orgsResponse, usersResponse] = await Promise.all([
          listResource<Organization>('organizations'),
          listCognitoUsers(),
        ]);
        setOrganizations(orgsResponse.items);
        const emailMap: Record<string, string> = {};
        for (const user of usersResponse.items) {
          if (user.sub && user.email) {
            emailMap[user.sub] = user.email;
          }
        }
        setManagerEmails(emailMap);
      } catch {
        // fall back to create-only
      } finally {
        setIsLoadingOrgs(false);
      }
    };
    loadOrgs();
  }, [isAccessRequest]);

  const handleSubmit = async () => {
    if (isAccessRequest && action === 'approve') {
      if (organizationMode === 'existing' && !selectedOrgId) {
        setError('Please select an organization');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');
    try {
      const payload: ReviewTicketPayload = {
        action,
        admin_notes: adminNotes.trim() || undefined,
      };

      if (action === 'approve') {
        if (isAccessRequest) {
          if (organizationMode === 'existing') {
            payload.organization_id = selectedOrgId;
          } else {
            payload.create_organization = true;
          }
        } else {
          payload.create_organization = createOrg;
        }
      }

      const response = await reviewTicket(ticket.id, payload);
      onReviewed(response.ticket);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : 'Failed to process ticket';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4'>
      <div className='max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-xl sm:p-6'>
        <h3 className='mb-4 text-base font-semibold sm:text-lg'>
          Review Ticket: <span className='break-all'>{ticket.ticket_id}</span>
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
            <span className='font-medium'>Type:</span>{' '}
            <TicketTypeBadge type={ticket.ticket_type} />
          </p>
          <p>
            <span className='font-medium'>Organization:</span>{' '}
            {ticket.organization_name}
          </p>
          <p className='break-all'>
            <span className='font-medium'>Submitted by:</span>{' '}
            {ticket.submitter_email}
          </p>
          {ticket.message && (
            <p>
              <span className='font-medium'>Message:</span> {ticket.message}
            </p>
          )}
          {ticket.description && (
            <p>
              <span className='font-medium'>Description:</span>{' '}
              {ticket.description}
            </p>
          )}
          {ticket.suggested_district && (
            <p>
              <span className='font-medium'>District:</span>{' '}
              {ticket.suggested_district}
            </p>
          )}
          {ticket.suggested_address && (
            <p>
              <span className='font-medium'>Address:</span>{' '}
              {ticket.suggested_address}
            </p>
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

        {/* Access request: org selection */}
        {isAccessRequest && action === 'approve' && (
          <div className='mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3'>
            <Label>Organization Assignment</Label>
            <p className='text-xs text-slate-500'>
              The requester will become the manager of the selected organization.
            </p>
            <div className='flex gap-2'>
              <label className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='org-mode'
                  value='new'
                  checked={organizationMode === 'new'}
                  onChange={() => setOrganizationMode('new')}
                  className='h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500'
                />
                <span className='text-sm'>Create new</span>
              </label>
              <label className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='org-mode'
                  value='existing'
                  checked={organizationMode === 'existing'}
                  onChange={() => setOrganizationMode('existing')}
                  className='h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500'
                />
                <span className='text-sm'>Use existing</span>
              </label>
            </div>

            {organizationMode === 'new' ? (
              <div className='rounded border border-slate-200 bg-white p-2 text-sm'>
                <span className='text-slate-500'>New organization name:</span>{' '}
                <span className='font-medium'>{ticket.organization_name}</span>
              </div>
            ) : (
              <div>
                {isLoadingOrgs ? (
                  <p className='text-sm text-slate-500'>Loading organizations...</p>
                ) : organizations.length === 0 ? (
                  <p className='text-sm text-slate-500'>
                    No existing organizations available.
                  </p>
                ) : (
                  <Select
                    id='org-select'
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                  >
                    <option value=''>Select an organization...</option>
                    {organizations.map((org) => {
                      const managerEmail = managerEmails[org.manager_id];
                      const displayText = managerEmail
                        ? `${org.name} - ${managerEmail}`
                        : org.name;
                      return (
                        <option key={org.id} value={org.id}>
                          {displayText}
                        </option>
                      );
                    })}
                  </Select>
                )}
              </div>
            )}
          </div>
        )}

        {/* Suggestion: create org checkbox */}
        {!isAccessRequest && action === 'approve' && (
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
                ? 'Approve'
                : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Badges ---

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

function StatusBadge({ status }: { status: TicketStatus }) {
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

function TicketTypeBadge({ type }: { type: TicketType }) {
  const config = {
    access_request: { label: 'Access Request', color: 'bg-blue-100 text-blue-800' },
    organization_suggestion: { label: 'Suggestion', color: 'bg-purple-100 text-purple-800' },
  };
  const { label, color } = config[type];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}

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

  const loadItems = async (cursor?: string, reset = false) => {
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
  };

  useEffect(() => {
    loadItems(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter]);

  const handleReviewed = (updated: Ticket) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setReviewingTicket(null);
    loadItems(undefined, true);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.ticket_id?.toLowerCase().includes(query) ||
      item.organization_name?.toLowerCase().includes(query) ||
      item.submitter_email?.toLowerCase().includes(query) ||
      item.suggested_district?.toLowerCase().includes(query) ||
      item.status?.toLowerCase().includes(query)
    );
  });

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
            {filteredItems.length === 0 ? (
              <p className='text-sm text-slate-600'>
                No tickets match your search.
              </p>
            ) : (
              <>
                {/* Desktop table */}
                <div className='hidden overflow-x-auto md:block'>
                  <table className='w-full text-left text-sm'>
                    <thead className='border-b border-slate-200 text-slate-500'>
                      <tr>
                        <th className='py-2'>Ticket ID</th>
                        <th className='py-2'>Type</th>
                        <th className='py-2'>Organization</th>
                        <th className='py-2'>Submitted By</th>
                        <th className='py-2'>Status</th>
                        <th className='py-2'>Submitted</th>
                        <th className='py-2 text-right'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr key={item.id} className='border-b border-slate-100'>
                          <td className='py-2 font-mono text-xs'>
                            {item.ticket_id}
                          </td>
                          <td className='py-2'>
                            <TicketTypeBadge type={item.ticket_type} />
                          </td>
                          <td className='max-w-[200px] truncate py-2 font-medium'>
                            {item.organization_name}
                          </td>
                          <td className='max-w-[180px] truncate py-2 text-slate-600'>
                            {item.submitter_email}
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
                                onClick={() => setReviewingTicket(item)}
                                aria-label='Review ticket'
                              >
                                <ReviewIcon className='h-4 w-4' />
                              </Button>
                            ) : (
                              <span className='text-xs text-slate-400'>
                                {item.reviewed_at
                                  ? `Reviewed ${formatDate(item.reviewed_at)}`
                                  : '\u2014'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
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
                          <div className='mt-0.5 flex items-center gap-2 text-sm text-slate-500'>
                            {item.ticket_id}
                            <TicketTypeBadge type={item.ticket_type} />
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className='mt-2 space-y-1 text-sm'>
                        <div className='truncate text-slate-600'>
                          {item.submitter_email}
                        </div>
                        {item.suggested_district && (
                          <div className='text-slate-600'>
                            District: {item.suggested_district}
                          </div>
                        )}
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
                            onClick={() => setReviewingTicket(item)}
                            className='w-full'
                            aria-label='Review ticket'
                          >
                            <ReviewIcon className='h-4 w-4' />
                          </Button>
                        ) : (
                          <span className='block text-center text-xs text-slate-400'>
                            {item.reviewed_at
                              ? `Reviewed ${formatDate(item.reviewed_at)}`
                              : '\u2014'}
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

      {reviewingTicket && (
        <ReviewModal
          ticket={reviewingTicket}
          onClose={() => setReviewingTicket(null)}
          onReviewed={handleReviewed}
        />
      )}
    </div>
  );
}
