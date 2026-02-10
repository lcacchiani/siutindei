'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  ApiError,
  listFeedbackLabels,
  searchUserOrganizations,
  submitUserFeedback,
  type Ticket,
  type UserFeedbackCreatePayload,
} from '../../lib/api-client';
import type { FeedbackLabel } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

interface FeedbackFormProps {
  onFeedbackSubmitted: (feedback: Ticket) => void;
}

interface OrganizationOption {
  id: string;
  name: string;
}

const starOptions = Array.from({ length: 6 }, (_, i) => i);

export function FeedbackForm({ onFeedbackSubmitted }: FeedbackFormProps) {
  const [organizationQuery, setOrganizationQuery] = useState('');
  const [organizationMatches, setOrganizationMatches] = useState<
    OrganizationOption[]
  >([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState<OrganizationOption | null>(null);
  const [labels, setLabels] = useState<FeedbackLabel[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [stars, setStars] = useState('0');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    const trimmed = organizationQuery.trim();
    if (trimmed.length < 2) {
      setOrganizationMatches([]);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchUserOrganizations(trimmed, 10);
        setOrganizationMatches(response.items);
      } catch {
        setOrganizationMatches([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [organizationQuery]);

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  const selectedLabelNames = useMemo(() => {
    const map = new Map(labels.map((label) => [label.id, label.name]));
    return selectedLabels
      .map((id) => map.get(id))
      .filter((name): name is string => Boolean(name));
  }, [labels, selectedLabels]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!selectedOrganization) {
      setError('Please select an organization.');
      return;
    }
    const starsValue = Number(stars);
    if (!Number.isInteger(starsValue) || starsValue < 0 || starsValue > 5) {
      setError('Stars must be a whole number between 0 and 5.');
      return;
    }

    const payload: UserFeedbackCreatePayload = {
      organization_id: selectedOrganization.id,
      stars: starsValue,
      label_ids: selectedLabels,
      description: description.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      const response = await submitUserFeedback(payload);
      onFeedbackSubmitted({
        id: '',
        ticket_id: response.ticket_id,
        ticket_type: 'organization_feedback',
        organization_name: selectedOrganization.name,
        message: null,
        status: 'pending',
        submitter_id: '',
        submitter_email: '',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        admin_notes: null,
        media_urls: [],
        organization_id: selectedOrganization.id,
        feedback_stars: starsValue,
        feedback_label_ids: selectedLabels,
        feedback_text: description.trim() || null,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to submit feedback. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      title='Leave Feedback'
      description='Share your experience with an organization.'
    >
      {error && (
        <div className='mb-4'>
          <StatusBanner variant='error' title='Error'>
            {error}
          </StatusBanner>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <Label htmlFor='feedback-org'>Organization</Label>
          <Input
            id='feedback-org'
            value={organizationQuery}
            onChange={(e) => {
              setOrganizationQuery(e.target.value);
              setSelectedOrganization(null);
            }}
            placeholder='Search organizations...'
          />
          {isSearching && (
            <p className='mt-1 text-xs text-slate-500'>Searching...</p>
          )}
          {organizationMatches.length > 0 && !selectedOrganization && (
            <div className='mt-2 rounded border border-slate-200 bg-white'>
              {organizationMatches.map((org) => (
                <button
                  key={org.id}
                  type='button'
                  onClick={() => {
                    setSelectedOrganization(org);
                    setOrganizationQuery(org.name);
                    setOrganizationMatches([]);
                  }}
                  className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50'
                >
                  <span>{org.name}</span>
                </button>
              ))}
            </div>
          )}
          {selectedOrganization && (
            <p className='mt-2 text-xs text-slate-500'>
              Selected: {selectedOrganization.name}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor='feedback-stars'>Stars</Label>
          <Select
            id='feedback-stars'
            value={stars}
            onChange={(e) => setStars(e.target.value)}
          >
            {starOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Labels</Label>
          {labels.length === 0 ? (
            <p className='text-sm text-slate-500'>
              No labels available.
            </p>
          ) : (
            <div className='mt-2 flex flex-wrap gap-2'>
              {labels.map((label) => {
                const isSelected = selectedLabels.includes(label.id);
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
          {selectedLabelNames.length > 0 && (
            <p className='mt-2 text-xs text-slate-500'>
              Selected: {selectedLabelNames.join(', ')}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor='feedback-description'>Description</Label>
          <Textarea
            id='feedback-description'
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Share details about your experience...'
            maxLength={5000}
          />
        </div>

        <div className='pt-2'>
          <Button
            type='submit'
            variant='primary'
            disabled={isSubmitting}
            className='w-full sm:w-auto'
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
