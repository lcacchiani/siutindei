'use client';

import { useMemo, useState } from 'react';

import currencyCodes from 'currency-codes';

import { useActivitiesByMode } from '../../hooks/use-activities-by-mode';
import { useLocationsByMode } from '../../hooks/use-locations-by-mode';
import { useResourcePanel } from '../../hooks/use-resource-panel';
import { parseOptionalNumber } from '../../lib/number-parsers';
import type { ApiMode } from '../../lib/resource-api';
import type { ActivityPricing } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
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

interface CurrencyOption {
  code: string;
  name: string;
  label: string;
}

const defaultCurrencyCode = 'HKD';

const emptyForm: PricingFormState = {
  activity_id: '',
  location_id: '',
  pricing_type: 'per_class',
  amount: '',
  currency: defaultCurrencyCode,
  sessions_count: '',
};

const pricingOptions = [
  { value: 'per_class', label: 'Per class' },
  { value: 'per_month', label: 'Per month' },
  { value: 'per_sessions', label: 'Per sessions' },
];

const pricingTypeLabelByValue = new Map(
  pricingOptions.map((option) => [option.value, option.label])
);

function getPricingTypeLabel(value: string): string {
  return pricingTypeLabelByValue.get(value) ?? value;
}

function itemToForm(item: ActivityPricing): PricingFormState {
  return {
    activity_id: item.activity_id ?? '',
    location_id: item.location_id ?? '',
    pricing_type: item.pricing_type,
    amount: item.amount != null ? String(item.amount) : '',
    currency: normalizeCurrencyCode(item.currency),
    sessions_count: item.sessions_count ? `${item.sessions_count}` : '',
  };
}

function normalizeCurrencyCode(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return defaultCurrencyCode;
  }
  return trimmed.toUpperCase();
}

interface PricingPanelProps {
  mode: ApiMode;
}

export function PricingPanel({ mode }: PricingPanelProps) {
  const panel = useResourcePanel<ActivityPricing, PricingFormState>(
    'pricing',
    mode,
    emptyForm,
    itemToForm
  );

  const { items: activities } = useActivitiesByMode(mode, { limit: 200 });
  const { items: locations } = useLocationsByMode(mode, { limit: 200 });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const display =
      typeof Intl !== 'undefined' &&
      typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames(['en'], { type: 'currency' })
        : null;
    const optionsMap = new Map<string, CurrencyOption>();
    for (const record of currencyCodes.data) {
      const code = record.code?.toUpperCase();
      if (!code) {
        continue;
      }
      const name = display?.of(code) ?? record.currency ?? code;
      optionsMap.set(code, {
        code,
        name,
        label: `${name} (${code})`,
      });
    }
    if (!optionsMap.has(defaultCurrencyCode)) {
      const name =
        display?.of(defaultCurrencyCode) ?? defaultCurrencyCode;
      optionsMap.set(defaultCurrencyCode, {
        code: defaultCurrencyCode,
        name,
        label: `${name} (${defaultCurrencyCode})`,
      });
    }
    return Array.from(optionsMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, []);

  const currencyNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of currencyOptions) {
      map.set(option.code, option.name);
    }
    return map;
  }, [currencyOptions]);

  function getCurrencyDisplay(value?: string | null): string {
    return normalizeCurrencyCode(value);
  }

  function formatAmount(value: number): string {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function getCurrencySearchText(value?: string | null): string {
    const normalized = normalizeCurrencyCode(value);
    const name = currencyNameByCode.get(normalized);
    return name ? `${name} ${normalized}` : normalized;
  }

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
    currency: normalizeCurrencyCode(form.currency),
    sessions_count:
      form.pricing_type === 'per_sessions'
        ? parseOptionalNumber(form.sessions_count)
        : null,
  });

  const handleSubmit = () => panel.handleSubmit(formToPayload, validate);

  const showSessionsField = panel.formState.pricing_type === 'per_sessions';

  function getActivityName(activityId: string) {
    return (
      activities.find((activity) => activity.id === activityId)?.name ??
      activityId
    );
  }

  function getLocationName(locationId: string) {
    return (
      locations.find((location) => location.id === locationId)?.address ??
      locationId
    );
  }

  const columns = [
    {
      key: 'activity',
      header: 'Activity',
      primary: true,
      render: (item: ActivityPricing) => (
        <span className='font-medium'>
          {getActivityName(item.activity_id)}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      secondary: true,
      render: (item: ActivityPricing) => (
        <span className='text-slate-600'>
          {getLocationName(item.location_id)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: ActivityPricing) => (
        <span className='text-slate-600'>
          {getPricingTypeLabel(item.pricing_type)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: ActivityPricing) => (
        <span className='text-slate-600'>
          {getCurrencyDisplay(item.currency)} {formatAmount(item.amount)}
        </span>
      ),
    },
  ];

  // Filter items based on search query
  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    const activityName = getActivityName(item.activity_id);
    const locationName = getLocationName(item.location_id);
    const pricingTypeLabel = getPricingTypeLabel(item.pricing_type);
    const pricingTypeSearch =
      `${pricingTypeLabel} ${item.pricing_type}`.toLowerCase();
    const currencySearch = getCurrencySearchText(item.currency).toLowerCase();
    return (
      activityName.toLowerCase().includes(query) ||
      locationName.toLowerCase().includes(query) ||
      pricingTypeSearch.includes(query) ||
      String(item.amount).toLowerCase().includes(query) ||
      currencySearch.includes(query)
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
                  {location.address || location.area_id}
                </option>
              ))}
            </Select>
          </div>
          <div className='md:col-span-2'>
            <div className='grid gap-4 sm:grid-cols-2'>
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
          </div>
          <div className='md:col-span-2'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='pricing-currency'>Currency</Label>
                <Select
                  id='pricing-currency'
                  value={panel.formState.currency}
                  onChange={(e) =>
                    panel.setFormState((prev) => ({
                      ...prev,
                      currency: normalizeCurrencyCode(e.target.value),
                    }))
                  }
                >
                  {currencyOptions.map((option) => (
                    <option key={option.code} value={option.code}>
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
            </div>
          </div>
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
            <DataTable
              columns={columns}
              data={filteredItems}
              keyExtractor={(item) => item.id}
              onEdit={(item) => panel.startEdit(item)}
              onDelete={(item) =>
                panel.handleDelete({
                  ...item,
                  name: getActivityName(item.activity_id),
                })
              }
              nextCursor={panel.nextCursor}
              onLoadMore={panel.loadMore}
              isLoading={panel.isLoading}
              emptyMessage={
                searchQuery.trim()
                  ? 'No pricing entries match your search.'
                  : 'No pricing entries yet.'
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
