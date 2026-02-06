'use client';

import { useState } from 'react';

import {
  ApiError,
  submitOrganizationSuggestion,
  type SubmitSuggestionPayload,
  type Ticket,
} from '../../lib/api-client';
import {
  AddressAutocomplete,
  type AddressSelection,
} from '../ui/address-autocomplete';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

interface SuggestionFormProps {
  onSuggestionSubmitted: (suggestion: Ticket) => void;
}

export function SuggestionForm({ onSuggestionSubmitted }: SuggestionFormProps) {
  const [organizationName, setOrganizationName] = useState('');
  const [description, setDescription] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddressSelect = (selection: AddressSelection) => {
    setAddress(selection.displayName);
    setSelectedLat(selection.lat);
    setSelectedLng(selection.lng);
    // Auto-fill district if empty.
    if (!district.trim()) {
      setDistrict(selection.district);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationName.trim()) {
      setError('Organization name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload: SubmitSuggestionPayload = {
        organization_name: organizationName.trim(),
      };

      if (description.trim()) {
        payload.description = description.trim();
      }
      if (district.trim()) {
        payload.suggested_district = district.trim();
      }
      if (address.trim()) {
        payload.suggested_address = address.trim();
      }
      if (selectedLat !== null && selectedLng !== null) {
        payload.suggested_lat = selectedLat;
        payload.suggested_lng = selectedLng;
      }
      if (additionalNotes.trim()) {
        payload.additional_notes = additionalNotes.trim();
      }

      const response = await submitOrganizationSuggestion(payload);
      // Backend returns { message, ticket_id } for async processing.
      // Construct a partial Ticket from known data for the pending notice.
      onSuggestionSubmitted({
        id: '',
        ticket_id: response.ticket_id,
        ticket_type: 'organization_suggestion',
        organization_name: organizationName.trim(),
        message: additionalNotes.trim() || null,
        description: description.trim() || null,
        suggested_district: district.trim() || null,
        suggested_address: address.trim() || null,
        suggested_lat: selectedLat,
        suggested_lng: selectedLng,
        media_urls: [],
        status: 'pending',
        submitter_id: '',
        submitter_email: '',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      });
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : 'Failed to submit suggestion. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      title='Suggest a Place'
      description='Know a great place for kids activities? Let us know about it!'
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
          <Label htmlFor='organization-name'>
            Organization/Place Name <span className='text-red-500'>*</span>
          </Label>
          <Input
            id='organization-name'
            type='text'
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder='e.g., Happy Kids Dance Studio'
            required
            maxLength={200}
          />
        </div>

        <div>
          <Label htmlFor='description'>Description</Label>
          <Textarea
            id='description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='What kind of activities do they offer?'
            rows={3}
            maxLength={2000}
          />
        </div>

        <div>
          <Label htmlFor='district'>District/Area</Label>
          <Input
            id='district'
            type='text'
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder='e.g., Downtown, North Side'
            maxLength={100}
          />
        </div>

        <div>
          <Label htmlFor='address'>Address</Label>
          <AddressAutocomplete
            id='address'
            value={address}
            onChange={setAddress}
            onSelect={handleAddressSelect}
            placeholder='Start typing the address...'
            maxLength={500}
          />
        </div>

        <div>
          <Label htmlFor='additional-notes'>Additional Notes</Label>
          <Textarea
            id='additional-notes'
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder='Any other information that might be helpful...'
            rows={2}
            maxLength={2000}
          />
        </div>

        <div className='pt-2'>
          <Button
            type='submit'
            variant='primary'
            disabled={isSubmitting || !organizationName.trim()}
            className='w-full sm:w-auto'
          >
            {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
