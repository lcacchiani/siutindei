'use client';

import { useEffect, useMemo, useState } from 'react';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import { ApiError, listResource } from '../../lib/api-client';
import type {
  FeedbackLabel,
  Organization,
  OrganizationFeedback,
} from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

interface FeedbackFormState {
  organization_id: string;
  submitter_id: string;
  submitter_email: string;
  stars: string;
  label_ids: string[];
  description: string;
  source_ticket_id: string;
}

const emptyForm: FeedbackFormState = {
  organization_id: '',
  submitter_id: '',
  submitter_email: '',
  stars: '0',
  label_ids: [],
  description: '',
  source_ticket_id: '',
};

function itemToForm(item: OrganizationFeedback): FeedbackFormState {
  return {
    organization_id: item.organization_id ?? '',
    submitter_id: item.submitter_id ?? '',
    submitter_email: item.submitter_email ?? '',
    stars: item.stars !== undefined ? `${item.stars}` : '0',
    label_ids: item.label_ids ?? [],
    description: item.description ?? '',
    source_ticket_id: item.source_ticket_id ?? '',
  };
}

function parseStars(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function FeedbackPanel() {
  const panel = useResourcePanel<OrganizationFeedback, FeedbackFormState>(
    'organization-feedback',
    'admin',
    emptyForm,
    itemToForm
  );

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [labels, setLabels] = useState<FeedbackLabel[]>([]);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    const loadLookups = async () => {
      setLookupError('');
      try {
        const [orgResponse, labelResponse] = await Promise.all([
          listResource<Organization>('organizations'),
          listResource<FeedbackLabel>('feedback-labels'),
        ]);
        setOrganizations(orgResponse.items);
        setLabels(labelResponse.items);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Failed to load feedback lookups.';
        setLookupError(message);
      }
    };
    loadLookups();
  }, []);

  const labelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const label of labels) {
      map.set(label.id, label.name);
    }
    return map;
  }, [labels]);

  const toggleLabel = (labelId: string) => {
    panel.setFormState((prev) => {
      const hasLabel = prev.label_ids.includes(labelId);
      return {
        ...prev,
        label_ids: hasLabel
          ? prev.label_ids.filter((id) => id !== labelId)
          : [...prev.label_ids, labelId],
      };
    });
  };

  const validate = () => {
    if (!panel.formState.organization_id) {
      return 'Select an organization.';
    }
    const stars = parseStars(panel.formState.stars);
    if (stars === null || stars < 0 || stars > 5) {
      return 'Stars must be a whole number between 0 and 5.';
    }
    return null;
  };

  const formToPayload = (form: FeedbackFormState) => ({
    organization_id: form.organization_id,
    submitter_id: form.submitter_id.trim() || undefined,
    submitter_email: form.submitter_email.trim() || undefined,
    stars: parseStars(form.stars),
    label_ids: form.label_ids,
    description: form.description.trim() || undefined,
    source_ticket_id: form.source_ticket_id.trim() || undefined,
  });

  const columns = [
    {
      key: 'organization',
      header: 'Organization',
      primary: true,
      render: (item: OrganizationFeedback) =>
        item.organization_name || item.organization_id,
    },
    {
      key: 'stars',
      header: 'Stars',
      render: (item: OrganizationFeedback) => item.stars,
    },
    {
      key: 'labels',
      header: 'Labels',
      render: (item: OrganizationFeedback) => {
        const names =
          item.label_ids?.map((id) => labelNameById.get(id) || id) ?? [];
        return (
          <span className='text-slate-600'>
            {names.length ? names.join(', ') : '—'}
          </span>
        );
      },
    },
    {
      key: 'submitter',
      header: 'Submitter',
      render: (item: OrganizationFeedback) => (
        <span className='text-slate-600'>
          {item.submitter_email || item.submitter_id || '—'}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Submitted',
      render: (item: OrganizationFeedback) => (
        <span className='text-slate-600'>
          {formatDate(item.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className='space-y-6'>
      <Card
        title={panel.editingId ? 'Edit Feedback' : 'New Feedback'}
        description='Manage approved feedback entries for organizations.'
      >
        {panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        {lookupError && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Lookups'>
              {lookupError}
            </StatusBanner>
          </div>
        )}

        <div className='space-y-4'>
          <div>
            <Label htmlFor='feedback-organization'>Organization</Label>
            <Select
              id='feedback-organization'
              value={panel.formState.organization_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  organization_id: e.target.value,
                }))
              }
            >
              <option value=''>Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <Label htmlFor='feedback-stars'>Stars</Label>
              <Input
                id='feedback-stars'
                type='number'
                min='0'
                max='5'
                value={panel.formState.stars}
                onChange={(e) =>
                  panel.setFormState((prev) => ({
                    ...prev,
                    stars: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor='feedback-ticket-id'>Source Ticket ID</Label>
              <Input
                id='feedback-ticket-id'
                type='text'
                value={panel.formState.source_ticket_id}
                onChange={(e) =>
                  panel.setFormState((prev) => ({
                    ...prev,
                    source_ticket_id: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <Label htmlFor='feedback-submit-id'>Submitter ID</Label>
              <Input
                id='feedback-submit-id'
                type='text'
                value={panel.formState.submitter_id}
                onChange={(e) =>
                  panel.setFormState((prev) => ({
                    ...prev,
                    submitter_id: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor='feedback-submit-email'>Submitter Email</Label>
              <Input
                id='feedback-submit-email'
                type='email'
                value={panel.formState.submitter_email}
                onChange={(e) =>
                  panel.setFormState((prev) => ({
                    ...prev,
                    submitter_email: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <Label>Labels</Label>
            {labels.length === 0 ? (
              <p className='text-sm text-slate-500'>
                No feedback labels available.
              </p>
            ) : (
              <div className='mt-2 flex flex-wrap gap-2'>
                {labels.map((label) => {
                  const isSelected = panel.formState.label_ids.includes(
                    label.id
                  );
                  return (
                    <button
                      key={label.id}
                      type='button'
                      onClick={() => toggleLabel(label.id)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor='feedback-description'>Description</Label>
            <Textarea
              id='feedback-description'
              rows={3}
              value={panel.formState.description}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </div>

          <div className='flex flex-wrap gap-2 pt-2'>
            <Button
              type='button'
              variant='primary'
              onClick={() => panel.handleSubmit(formToPayload, validate)}
              disabled={panel.isSaving}
            >
              {panel.isSaving ? 'Saving...' : 'Save Feedback'}
            </Button>
            {panel.editingId && (
              <Button
                type='button'
                variant='secondary'
                onClick={panel.resetForm}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card
        title='Organization Feedback'
        description='Review and maintain approved feedback entries.'
      >
        <DataTable
          columns={columns}
          data={panel.items}
          keyExtractor={(item) => item.id}
          onEdit={panel.startEdit}
          onDelete={panel.handleDelete}
          nextCursor={panel.nextCursor}
          onLoadMore={panel.loadMore}
          isLoading={panel.isLoading}
          emptyMessage='No feedback entries found.'
        />
      </Card>
    </div>
  );
}
