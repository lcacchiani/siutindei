'use client';

import { useEffect, useState } from 'react';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import {
  listResource,
  listOwnerActivities,
  listOwnerLocations,
} from '../../lib/api-client';
import type { ApiMode } from '../../lib/resource-api';
import type { Activity, ActivityPricing, Location } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBanner } from '../status-banner';

interface PricingFormState {
  activity_id: string;
  location_id: string;
  pricing_type: string;
  amount: string;
  currency: string;
  sessions_count: string;
}

const emptyForm: PricingFormState = {
  activity_id: '',
  location_id: '',
  pricing_type: 'per_class',
  amount: '',
  currency: 'HKD',
  sessions_count: '',
};

const pricingOptions = [
  { value: 'per_class', label: 'Per class' },
  { value: 'per_month', label: 'Per month' },
  { value: 'per_sessions', label: 'Per sessions' },
];

function itemToForm(item: ActivityPricing): PricingFormState {
  return {
    activity_id: item.activity_id ?? '',
    location_id: item.location_id ?? '',
    pricing_type: item.pricing_type,
    amount: item.amount ?? '',
    currency: item.currency ?? 'HKD',
    sessions_count: item.sessions_count ? `${item.sessions_count}` : '',
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface PricingPanelProps {
  mode: ApiMode;
}

export function PricingPanel({ mode }: PricingPanelProps) {
  const isAdmin = mode === 'admin';
  const panel = useResourcePanel<ActivityPricing, PricingFormState>(
    'pricing',
    mode,
    emptyForm,
    itemToForm
  );

  const [activities, setActivities] = useState<Activity[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadReferences = async () => {
      try {
        if (isAdmin) {
          const [activitiesResponse, locationsResponse] = await Promise.all([
            listResource<Activity>('activities', undefined, 200),
            listResource<Location>('locations', undefined, 200),
          ]);
          setActivities(activitiesResponse.items);
          setLocations(locationsResponse.items);
        } else {
          const [activitiesResponse, locationsResponse] = await Promise.all([
            listOwnerActivities(),
            listOwnerLocations(),
          ]);
          setActivities(activitiesResponse.items);
          setLocations(locationsResponse.items);
        }
      } catch {
        setActivities([]);
        setLocations([]);
      }
    };
    loadReferences();
  }, [isAdmin]);

  const validate = () => {
    if (!panel.formState.activity_id || !panel.formState.location_id) {
      return 'Activity and location are required.';
    }
    if (!panel.formState.amount.trim()) {
      return 'Amount is required.';
    }
    const amountValue = Number(panel.formState.amount);
    if (!Number.isFinite(amountValue)) {
      return 'Amount must be numeric.';
    }
    if (panel.formState.pricing_type === 'per_sessions') {
      const sessionsCount = parseOptionalNumber(panel.formState.sessions_count);
      if (sessionsCount === null || sessionsCount <= 0) {
        return 'Sessions count is required for per-sessions pricing.';
      }
    }
    return null;
  };

  const formToPayload = (form: PricingFormState) => ({
    activity_id: form.activity_id,
    location_id: form.location_id,
    pricing_type: form.pricing_type,
    amount: form.amount.trim(),
    currency: form.currency.trim() || 'HKD',
    sessions_count:
      form.pricing_type === 'per_sessions'
        ? parseOptionalNumber(form.sessions_count)
        : null,
  });

  const handleSubmit = () => panel.handleSubmit(formToPayload, validate);

  const showSessionsField = panel.formState.pricing_type === 'per_sessions';

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const activityName = activities.find((a) => a.id === item.activity_id)?.name?.toLowerCase() || '';
    const locationName = locations.find((l) => l.id === item.location_id)?.district?.toLowerCase() || '';
    return (
      activityName.includes(query) ||
      locationName.includes(query) ||
      item.pricing_type?.toLowerCase().includes(query) ||
      item.amount?.toLowerCase().includes(query) ||
      item.currency?.toLowerCase().includes(query)
    );
  });

  return (
    <div className='space-y-6'>
      <Card title='Pricing' description='Manage pricing entries.'>
        {panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <Label htmlFor='pricing-activity'>Activity</Label>
            <Select
              id='pricing-activity'
              value={panel.formState.activity_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  activity_id: e.target.value,
                }))
              }
            >
              <option value=''>Select activity</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='pricing-location'>Location</Label>
            <Select
              id='pricing-location'
              value={panel.formState.location_id}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  location_id: e.target.value,
                }))
              }
            >
              <option value=''>Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.district}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='pricing-type'>Pricing Type</Label>
            <Select
              id='pricing-type'
              value={panel.formState.pricing_type}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  pricing_type: e.target.value,
                  sessions_count:
                    e.target.value === 'per_sessions'
                      ? prev.sessions_count
                      : '',
                }))
              }
            >
              {pricingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='pricing-amount'>Amount</Label>
            <Input
              id='pricing-amount'
              type='number'
              step='0.01'
              value={panel.formState.amount}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  amount: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor='pricing-currency'>Currency</Label>
            <Input
              id='pricing-currency'
              value={panel.formState.currency}
              onChange={(e) =>
                panel.setFormState((prev) => ({
                  ...prev,
                  currency: e.target.value,
                }))
              }
            />
          </div>
          {showSessionsField && (
            <div>
              <Label htmlFor='pricing-sessions'>Sessions Count</Label>
              <Input
                id='pricing-sessions'
                type='number'
                min='1'
                value={panel.formState.sessions_count}
                onChange={(e) =>
                  panel.setFormState((prev) => ({
                    ...prev,
                    sessions_count: e.target.value,
                  }))
                }
              />
            </div>
          )}
        </div>
        <div className='mt-4 flex flex-wrap gap-3'>
          <Button
            type='button'
            onClick={handleSubmit}
            disabled={panel.isSaving}
          >
            {panel.editingId ? 'Update Pricing' : 'Add Pricing'}
          </Button>
          {panel.editingId && (
            <Button
              type='button'
              variant='secondary'
              onClick={panel.resetForm}
              disabled={panel.isSaving}
            >
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <Card
        title='Existing Pricing'
        description='Select a pricing entry to edit or delete.'
      >
        {panel.isLoading ? (
          <p className='text-sm text-slate-600'>Loading pricing...</p>
        ) : panel.items.length === 0 ? (
          <p className='text-sm text-slate-600'>No pricing entries yet.</p>
        ) : (
          <div className='space-y-4'>
            <div className='max-w-full sm:max-w-sm'>
              <SearchInput
                placeholder='Search pricing...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredItems.length === 0 ? (
              <p className='text-sm text-slate-600'>No pricing entries match your search.</p>
            ) : (
            <>
            {/* Desktop table view */}
            <div className='hidden overflow-x-auto md:block'>
            <table className='w-full text-left text-sm'>
              <thead className='border-b border-slate-200 text-slate-500'>
                <tr>
                  <th className='py-2'>Activity</th>
                  <th className='py-2'>Location</th>
                  <th className='py-2'>Type</th>
                  <th className='py-2'>Amount</th>
                  <th className='py-2 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const activityName =
                    activities.find((a) => a.id === item.activity_id)?.name ||
                    item.activity_id;
                  const locationName =
                    locations.find((l) => l.id === item.location_id)?.district ||
                    item.location_id;
                  return (
                    <tr key={item.id} className='border-b border-slate-100'>
                      <td className='py-2 font-medium'>{activityName}</td>
                      <td className='py-2 text-slate-600'>{locationName}</td>
                      <td className='py-2 text-slate-600'>{item.pricing_type}</td>
                      <td className='py-2 text-slate-600'>
                        {item.amount} {item.currency}
                      </td>
                      <td className='py-2 text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant='secondary'
                            onClick={() => panel.startEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='danger'
                            onClick={() =>
                              panel.handleDelete({ ...item, name: activityName })
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile card view */}
            <div className='space-y-3 md:hidden'>
              {filteredItems.map((item) => {
                const activityName =
                  activities.find((a) => a.id === item.activity_id)?.name ||
                  item.activity_id;
                const locationName =
                  locations.find((l) => l.id === item.location_id)?.district ||
                  item.location_id;
                return (
                  <div
                    key={item.id}
                    className='rounded-lg border border-slate-200 bg-slate-50 p-3'
                  >
                    <div className='font-medium text-slate-900'>{activityName}</div>
                    <div className='mt-1 text-sm text-slate-600'>{locationName}</div>
                    <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm'>
                      <span className='text-slate-500'>
                        Type: <span className='text-slate-700'>{item.pricing_type}</span>
                      </span>
                      <span className='text-slate-500'>
                        Amount:{' '}
                        <span className='font-medium text-slate-900'>
                          {item.amount} {item.currency}
                        </span>
                      </span>
                    </div>
                    <div className='mt-3 flex gap-2 border-t border-slate-200 pt-3'>
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        onClick={() => panel.startEdit(item)}
                        className='flex-1'
                      >
                        Edit
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        onClick={() =>
                          panel.handleDelete({ ...item, name: activityName })
                        }
                        className='flex-1'
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {panel.nextCursor && (
              <div className='mt-4'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={panel.loadMore}
                  className='w-full sm:w-auto'
                >
                  Load more
                </Button>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
