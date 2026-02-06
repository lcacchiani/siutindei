'use client';

import type { Ticket } from '../../lib/api-client';
import { Card } from '../ui/card';
import { StatusBanner } from '../status-banner';

interface PendingSuggestionNoticeProps {
  suggestion: Ticket;
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
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

export function PendingSuggestionNotice({
  suggestion,
}: PendingSuggestionNoticeProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
          <p className='text-sm'>{formatDate(suggestion.created_at)}</p>
        </div>
      </div>

      <p className='mt-4 text-sm text-slate-600'>
        You can submit another suggestion once this one has been reviewed.
      </p>
    </Card>
  );
}
