'use client';

import type { Ticket } from '../../lib/api-client-user';
import { formatDateTime } from '../../lib/date-utils';
import { Card } from '../ui/card';
import { StatusBadge } from '../ui/status-badge';
import { StatusBanner } from '../status-banner';

interface PendingSuggestionNoticeProps {
  suggestion: Ticket;
}

export function PendingSuggestionNotice({
  suggestion,
}: PendingSuggestionNoticeProps) {
  return (
    <Card
      title='Your Suggestion'
      description='Thank you for helping us discover new places!'
    >
      <StatusBanner variant='info' title='Suggestion Submitted'>
        Your suggestion is being reviewed by our team. We&apos;ll notify you once
        it&apos;s been processed.
      </StatusBanner>

      <div className='mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4'>
        <div className='flex items-start justify-between'>
          <div>
            <span className='text-sm text-slate-500'>Ticket ID</span>
            <p className='font-medium'>{suggestion.ticket_id}</p>
          </div>
          <StatusBadge status={suggestion.status} />
        </div>

        <div>
          <span className='text-sm text-slate-500'>Organization Name</span>
          <p className='font-medium'>{suggestion.organization_name}</p>
        </div>

        {suggestion.description && (
          <div>
            <span className='text-sm text-slate-500'>Description</span>
            <p className='text-sm'>{suggestion.description}</p>
          </div>
        )}

        {suggestion.suggested_district && (
          <div>
            <span className='text-sm text-slate-500'>District</span>
            <p className='text-sm'>{suggestion.suggested_district}</p>
          </div>
        )}

        {suggestion.suggested_address && (
          <div>
            <span className='text-sm text-slate-500'>Address</span>
            <p className='text-sm'>{suggestion.suggested_address}</p>
          </div>
        )}

        <div>
          <span className='text-sm text-slate-500'>Submitted</span>
          <p className='text-sm'>{formatDateTime(suggestion.created_at)}</p>
        </div>
      </div>

      <p className='mt-4 text-sm text-slate-600'>
        You can submit another suggestion once this one has been reviewed.
      </p>
    </Card>
  );
}
