'use client';

import { useEffect, useMemo, useState } from 'react';

import { listFeedbackLabels, type Ticket } from '../../lib/api-client';
import type { FeedbackLabel } from '../../types/admin';
import { Card } from '../ui/card';
import { StatusBanner } from '../status-banner';

interface PendingFeedbackNoticeProps {
  feedback: Ticket;
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

export function PendingFeedbackNotice({
  feedback,
}: PendingFeedbackNoticeProps) {
  const [labels, setLabels] = useState<FeedbackLabel[]>([]);

  useEffect(() => {
    const loadLabels = async () => {
      try {
        const response = await listFeedbackLabels();
        setLabels(response.items);
      } catch {
        setLabels([]);
      }
    };
    loadLabels();
  }, []);

  const labelNames = useMemo(() => {
    const map = new Map(labels.map((label) => [label.id, label.name]));
    return feedback.feedback_label_ids?.map(
      (id) => map.get(id) || id
    );
  }, [feedback.feedback_label_ids, labels]);

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
      title='Your Feedback'
      description='Thank you for sharing your experience!'
    >
      <StatusBanner variant='info' title='Feedback Submitted'>
        Your feedback is being reviewed by our team. We&apos;ll notify you
        once it&apos;s been processed.
      </StatusBanner>

      <div className='mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4'>
        <div className='flex items-start justify-between'>
          <div>
            <span className='text-sm text-slate-500'>Ticket ID</span>
            <p className='font-medium'>{feedback.ticket_id}</p>
          </div>
          <StatusBadge status={feedback.status} />
        </div>

        <div>
          <span className='text-sm text-slate-500'>Organization</span>
          <p className='font-medium'>{feedback.organization_name}</p>
        </div>

        <div>
          <span className='text-sm text-slate-500'>Stars</span>
          <p className='text-sm'>{feedback.feedback_stars ?? '—'}</p>
        </div>

        {labelNames && labelNames.length > 0 && (
          <div>
            <span className='text-sm text-slate-500'>Labels</span>
            <p className='text-sm'>{labelNames.join(', ')}</p>
          </div>
        )}

        {feedback.feedback_text && (
          <div>
            <span className='text-sm text-slate-500'>Description</span>
            <p className='text-sm'>{feedback.feedback_text}</p>
          </div>
        )}

        <div>
          <span className='text-sm text-slate-500'>Submitted</span>
          <p className='text-sm'>{formatDate(feedback.created_at)}</p>
        </div>
      </div>

      <p className='mt-4 text-sm text-slate-600'>
        You can submit another feedback entry once this one has been
        reviewed.
      </p>
    </Card>
  );
}
