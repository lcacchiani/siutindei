'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { ApiError, listResource } from '../../../lib/api-client';
import { listCognitoUsers } from '../../../lib/api-client-cognito';
import {
  reviewTicket,
  type ReviewTicketPayload,
  type Ticket,
  type TicketType,
} from '../../../lib/api-client-tickets';
import type { Organization } from '../../../types/admin';
import { StatusBanner } from '../../status-banner';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Select } from '../../ui/select';
import { Textarea } from '../../ui/textarea';

interface ReviewModalProps {
  ticket: Ticket;
  onClose: () => void;
  onReviewed: (updated: Ticket) => void;
  labelNameById: Record<string, string>;
}

type OrganizationMode = 'existing' | 'new';

export function ReviewModal({
  ticket,
  onClose,
  onReviewed,
  labelNameById,
}: ReviewModalProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [createOrg, setCreateOrg] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [managerEmails, setManagerEmails] = useState<Record<string, string>>({});
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [organizationMode, setOrganizationMode] = useState<OrganizationMode>('new');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [orgTouched, setOrgTouched] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const isAccessRequest = ticket.ticket_type === 'access_request';
  const feedbackLabels =
    ticket.feedback_label_ids?.map((id) => labelNameById[id] || id) ?? [];

  const requiredIndicator = (
    <span className='text-red-500' aria-hidden='true'>
      *
    </span>
  );
  const errorInputClassName =
    'border-red-500 focus:border-red-500 focus:ring-red-500';
  const orgError =
    organizationMode === 'existing' && !selectedOrgId
      ? 'Choose an organization to continue.'
      : '';
  const showOrgError = Boolean(orgError && (hasSubmitted || orgTouched));

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
        // Fall back to create-only mode when loading fails.
      } finally {
        setIsLoadingOrgs(false);
      }
    };
    void loadOrgs();
  }, [isAccessRequest]);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const initialFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    initialFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const handleSubmit = async () => {
    setHasSubmitted(true);
    if (
      isAccessRequest &&
      action === 'approve' &&
      organizationMode === 'existing' &&
      !selectedOrgId
    ) {
      setOrgTouched(true);
      setError('Please select an organization');
      return;
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
    <div
      className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-xl sm:p-6'
      >
        <h3 id={titleId} className='mb-4 text-base font-semibold sm:text-lg'>
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
          {ticket.feedback_stars !== null && ticket.feedback_stars !== undefined && (
            <p>
              <span className='font-medium'>Stars:</span> {ticket.feedback_stars}
            </p>
          )}
          {feedbackLabels.length > 0 && (
            <p>
              <span className='font-medium'>Labels:</span>{' '}
              {feedbackLabels.join(', ')}
            </p>
          )}
          {ticket.feedback_text && (
            <p>
              <span className='font-medium'>Feedback:</span> {ticket.feedback_text}
            </p>
          )}
          {ticket.description && (
            <p>
              <span className='font-medium'>Description:</span> {ticket.description}
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
              <span className='font-medium'>Address:</span> {ticket.suggested_address}
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
                  onChange={() => {
                    setOrganizationMode('new');
                    setSelectedOrgId('');
                    setOrgTouched(false);
                    setHasSubmitted(false);
                  }}
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
                  onChange={() => {
                    setOrganizationMode('existing');
                    setOrgTouched(false);
                    setHasSubmitted(false);
                  }}
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
                  <div className='space-y-1'>
                    <Label htmlFor='org-select'>
                      Organization <span className='ml-1'>{requiredIndicator}</span>
                    </Label>
                    <Select
                      id='org-select'
                      value={selectedOrgId}
                      onChange={(e) => {
                        setOrgTouched(true);
                        setSelectedOrgId(e.target.value);
                      }}
                      className={showOrgError ? errorInputClassName : ''}
                      aria-invalid={showOrgError || undefined}
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
                    {showOrgError && <p className='text-xs text-red-600'>{orgError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

export function TicketTypeBadge({ type }: { type: TicketType }) {
  const config = {
    access_request: {
      label: 'Access Request',
      color: 'bg-blue-100 text-blue-800',
    },
    organization_suggestion: {
      label: 'Suggestion',
      color: 'bg-purple-100 text-purple-800',
    },
    organization_feedback: {
      label: 'Feedback',
      color: 'bg-amber-100 text-amber-800',
    },
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
