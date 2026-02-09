'use client';

import { useState } from 'react';

import { useGeographicAreas } from '../../hooks/use-geographic-areas';
import {
  ApiError,
  submitOrganizationSuggestion,
  type GeographicAreaNode,
  type SubmitSuggestionPayload,
  type Ticket,
} from '../../lib/api-client';
import {
  AddressAutocomplete,
} from '../ui/address-autocomplete';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { CascadingAreaSelect } from '../ui/cascading-area-select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { StatusBanner } from '../status-banner';

interface SuggestionFormProps {
  onSuggestionSubmitted: (suggestion: Ticket) => void;
}

export function SuggestionForm({ onSuggestionSubmitted }: SuggestionFormProps) {
  const { tree, countryCodes, matchNominatimResult } = useGeographicAreas();

  const [organizationName, setOrganizationName] = useState('');
  const [description, setDescription] = useState('');
  const [areaId, setAreaId] = useState('');
  const [address, setAddress] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(
    {}
  );
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const requiredIndicator = (
    <span className='text-red-500' aria-hidden='true'>
      *
    </span>
  );
  const errorInputClassName =
    'border-red-500 focus:border-red-500 focus:ring-red-500';

  const orgNameError = organizationName.trim()
    ? ''
    : 'Enter an organization or place name.';
  const showOrgNameError = Boolean(
    orgNameError &&
      (hasSubmitted || touchedFields.organizationName)
  );

  const handleAddressSelect = (selection: import('../ui/address-autocomplete').AddressSelection) => {
    setAddress(selection.displayName);
    setSelectedLat(selection.lat);
    setSelectedLng(selection.lng);
    // Try to reverse-match area from Nominatim
    const match = matchNominatimResult(selection.raw);
    if (match) {
      setAreaId(match.areaId);
    }
  };

  const handleAreaChange = (id: string, _chain: GeographicAreaNode[]) => {
    setAreaId(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setTouchedFields((prev) => ({ ...prev, organizationName: true }));

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
      // Derive district name from area tree if an area was selected
      if (areaId) {
        const flat = tree.flatMap(function walk(n: GeographicAreaNode): GeographicAreaNode[] {
          return [n, ...(n.children ?? []).flatMap(walk)];
        });
        const area = flat.find((n) => n.id === areaId);
        if (area) {
          payload.suggested_district = area.name;
        }
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
        suggested_district: null,
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
        <div className='space-y-1'>
          <Label htmlFor='organization-name'>
            Organization/Place Name{' '}
            <span className='ml-1'>{requiredIndicator}</span>
          </Label>
          <Input
            id='organization-name'
            type='text'
            value={organizationName}
            onChange={(e) => {
              setTouchedFields((prev) => ({
                ...prev,
                organizationName: true,
              }));
              setOrganizationName(e.target.value);
            }}
            placeholder='e.g., Happy Kids Dance Studio'
            required
            maxLength={200}
            className={showOrgNameError ? errorInputClassName : ''}
            aria-invalid={showOrgNameError || undefined}
            onBlur={() =>
              setTouchedFields((prev) => ({
                ...prev,
                organizationName: true,
              }))
            }
          />
          {showOrgNameError ? (
            <p className='text-xs text-red-600'>{orgNameError}</p>
          ) : null}
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
          <Label htmlFor='address'>Address</Label>
          <AddressAutocomplete
            id='address'
            value={address}
            onChange={setAddress}
            onSelect={handleAddressSelect}
            placeholder='Start typing the address...'
            maxLength={500}
            countryCodes={countryCodes}
          />
        </div>
        <div>
          <Label>Location</Label>
          <CascadingAreaSelect
            tree={tree}
            value={areaId}
            onChange={handleAreaChange}
            disableCountry
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
