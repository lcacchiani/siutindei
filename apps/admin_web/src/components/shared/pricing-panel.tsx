'use client';

import { useEffect, useMemo, useState } from 'react';

import currencyCodes from 'currency-codes';

import { useActivitiesByMode } from '../../hooks/use-activities-by-mode';
import { useLocationsByMode } from '../../hooks/use-locations-by-mode';
import { useResourcePanel } from '../../hooks/use-resource-panel';
import {
  formatPriceAmount,
  parseOptionalNumber,
} from '../../lib/number-parsers';
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
  free_trial_class_offered: boolean;
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
  free_trial_class_offered: false,
};

const pricingOptions = [
  { value: 'per_class', label: 'Per class' },
  { value: 'per_sessions', label: 'Per term' },
  { value: 'per_hour', label: 'Hourly' },
  { value: 'per_day', label: 'Daily' },
  { value: 'free', label: 'Free' },
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
    amount:
      item.pricing_type === 'free'
        ? ''
        : item.amount != null
          ? String(item.amount)
          : '',
    currency: normalizeCurrencyCode(item.currency),
    sessions_count: item.sessions_count ? `${item.sessions_count}` : '',
    free_trial_class_offered: Boolean(item.free_trial_class_offered),
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
  const { editingId, formState, setFormState } = panel;

  const { items: activities } = useActivitiesByMode(mode, { limit: 200 });
  const { items: locations } = useLocationsByMode(mode, { limit: 200 });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const [touchedState, setTouchedState] = useState<{
    key: string;
    fields: Record<string, boolean>;
  }>({ key: '', fields: {} });
  const [submittedState, setSubmittedState] = useState<{
    key: string;
    value: boolean;
  }>({ key: '', value: false });

  const requiredIndicator = (
    <span className='text-red-500' aria-hidden='true'>
      *
    </span>
  );
  const errorInputClassName =
    'border-red-500 focus:border-red-500 focus:ring-red-500';

  const markTouched = (field: string) => {
    setTouchedState((prev) => {
      if (prev.key !== formKey) {
        return { key: formKey, fields: { [field]: true } };
      }
      if (prev.fields[field]) {
        return prev;
      }
      return { key: formKey, fields: { ...prev.fields, [field]: true } };
    });
    setSubmittedState((prev) => {
      if (prev.key !== formKey || isFormEmpty) {
        return { key: formKey, value: false };
      }
      return prev;
    });
  };
  const shouldShowError = (field: string, message: string) =>
    Boolean(
      message &&
        (hasSubmitted || activeTouchedFields[field])
    );

  useEffect(() => {
    if (editingId) {
      return;
    }
    const defaultActivityId =
      activities.length === 1 ? activities[0]?.id ?? '' : '';
    const defaultLocationId =
      locations.length === 1 ? locations[0]?.id ?? '' : '';
    const shouldSetActivityDefault =
      Boolean(defaultActivityId) && !formState.activity_id;
    const shouldSetLocationDefault =
      Boolean(defaultLocationId) && !formState.location_id;
    if (!shouldSetActivityDefault && !shouldSetLocationDefault) {
      return;
    }
    setFormState((prev) => {
      const nextActivityId = prev.activity_id || defaultActivityId;
      const nextLocationId = prev.location_id || defaultLocationId;
      if (
        nextActivityId === prev.activity_id &&
        nextLocationId === prev.location_id
      ) {
        return prev;
      }
      return {
        ...prev,
        activity_id: nextActivityId,
        location_id: nextLocationId,
      };
    });
  }, [
    activities,
    locations,
    editingId,
    formState.activity_id,
    formState.location_id,
    setFormState,
  ]);

  const isFormEmpty =
    panel.formState.activity_id === '' &&
    panel.formState.location_id === '' &&
    panel.formState.pricing_type === emptyForm.pricing_type &&
    panel.formState.amount.trim() === '' &&
    panel.formState.currency === defaultCurrencyCode &&
    panel.formState.sessions_count.trim() === '' &&
    panel.formState.free_trial_class_offered === false;

  const formKey = panel.editingId ?? 'new';
  const activeTouchedFields =
    isFormEmpty || touchedState.key !== formKey ? {} : touchedState.fields;
  const hasSubmitted =
    isFormEmpty || submittedState.key !== formKey ? false : submittedState.value;

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

  function getCurrencySearchText(value?: string | null): string {
    const normalized = normalizeCurrencyCode(value);
    const name = currencyNameByCode.get(normalized);
    return name ? `${name} ${normalized}` : normalized;
  }

  const isFreeType = panel.formState.pricing_type === 'free';
  const showSessionsField = panel.formState.pricing_type === 'per_sessions';
  const showFreeTrialToggle = showSessionsField;

  const validate = () => {
    if (!panel.formState.activity_id || !panel.formState.location_id) {
      return 'Activity and location are required.';
    }
    if (!isFreeType) {
      if (!panel.formState.amount.trim()) {
        return 'Amount is required.';
      }
      const amountValue = Number(panel.formState.amount);
      if (!Number.isFinite(amountValue)) {
        return 'Amount must be numeric.';
      }
      if (amountValue <= 0) {
        return 'Amount must be greater than 0.';
      }
    }
    if (panel.formState.pricing_type === 'per_sessions') {
      const sessionsCount = parseOptionalNumber(
        panel.formState.sessions_count
      );
      if (sessionsCount === null || sessionsCount <= 0) {
        return 'Classes per term is required for per-term pricing.';
      }
    }
    return null;
  };

  const locationError = panel.formState.location_id
    ? ''
    : 'Select a location.';
  const activityError = panel.formState.activity_id
    ? ''
    : 'Select an activity.';

  const amountError = useMemo(() => {
    if (isFreeType) {
      return '';
    }
    const trimmed = panel.formState.amount.trim();
    if (!trimmed) {
      return 'Enter an amount.';
    }
    const amountValue = Number(trimmed);
    if (!Number.isFinite(amountValue)) {
      return 'Amount must be numeric.';
    }
    if (amountValue <= 0) {
      return 'Amount must be greater than 0.';
    }
    return '';
  }, [isFreeType, panel.formState.amount]);

  const sessionsError = useMemo(() => {
    if (!showSessionsField) {
      return '';
    }
    const trimmed = panel.formState.sessions_count.trim();
    if (!trimmed) {
      return 'Enter classes per term.';
    }
    const parsed = parseOptionalNumber(panel.formState.sessions_count);
    if (parsed === null || parsed <= 0) {
      return 'Classes per term must be greater than 0.';
    }
    return '';
  }, [panel.formState.sessions_count, showSessionsField]);

  const formToPayload = (form: PricingFormState) => {
    const isFree = form.pricing_type === 'free';
    const isPerTerm = form.pricing_type === 'per_sessions';
    return {
      activity_id: form.activity_id,
      location_id: form.location_id,
      pricing_type: form.pricing_type,
      amount: isFree ? '0' : form.amount.trim(),
      currency: isFree
        ? defaultCurrencyCode
        : normalizeCurrencyCode(form.currency),
      sessions_count: isPerTerm
        ? parseOptionalNumber(form.sessions_count)
        : null,
      free_trial_class_offered: isPerTerm
        ? form.free_trial_class_offered
        : false,
    };
  };

  const handleSubmit = () => {
    setSubmittedState({ key: formKey, value: true });
    return panel.handleSubmit(formToPayload, validate);
  };

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
      key: 'location',
      header: 'Location',
      primary: true,
      render: (item: ActivityPricing) => (
        <span className='font-medium'>
          {getLocationName(item.location_id)}
        </span>
      ),
    },
    {
      key: 'activity',
      header: 'Activity',
      secondary: true,
      render: (item: ActivityPricing) => (
        <span className='text-slate-600'>
          {getActivityName(item.activity_id)}
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
      render: (item: ActivityPricing) =>
        item.pricing_type === 'free' ? (
          <span className='text-slate-600'>-</span>
        ) : (
          <span className='text-slate-600'>
            {getCurrencyDisplay(item.currency)}{' '}
            {formatPriceAmount(item.amount)}
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
    const amountSearch = String(item.amount).toLowerCase();
    const formattedAmountSearch = formatPriceAmount(item.amount).toLowerCase();
    return (
      activityName.toLowerCase().includes(query) ||
      locationName.toLowerCase().includes(query) ||
      pricingTypeSearch.includes(query) ||
      amountSearch.includes(query) ||
      formattedAmountSearch.includes(query) ||
      currencySearch.includes(query)
    );
  });

  const showLocationError = shouldShowError('location_id', locationError);
  const showActivityError = shouldShowError('activity_id', activityError);
  const showAmountError = shouldShowError('amount', amountError);
  const showSessionsError = shouldShowError(
    'sessions_count',
    sessionsError
  );

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
          <div className='space-y-1'>
            <Label htmlFor='pricing-location'>
              Location{' '}
              <span className='ml-1'>{requiredIndicator}</span>
            </Label>
            <Select
              id='pricing-location'
              value={panel.formState.location_id}
              onChange={(e) => {
                markTouched('location_id');
                panel.setFormState((prev) => ({
                  ...prev,
                  location_id: e.target.value,
                }));
              }}
              className={showLocationError ? errorInputClassName : ''}
              aria-invalid={showLocationError || undefined}
            >
              <option value=''>Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.address || location.area_id}
                </option>
              ))}
            </Select>
            {showLocationError ? (
              <p className='text-xs text-red-600'>{locationError}</p>
            ) : null}
          </div>
          <div className='space-y-1'>
            <Label htmlFor='pricing-activity'>
              Activity{' '}
              <span className='ml-1'>{requiredIndicator}</span>
            </Label>
            <Select
              id='pricing-activity'
              value={panel.formState.activity_id}
              onChange={(e) => {
                markTouched('activity_id');
                panel.setFormState((prev) => ({
                  ...prev,
                  activity_id: e.target.value,
                }));
              }}
              className={showActivityError ? errorInputClassName : ''}
              aria-invalid={showActivityError || undefined}
            >
              <option value=''>Select activity</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </Select>
            {showActivityError ? (
              <p className='text-xs text-red-600'>{activityError}</p>
            ) : null}
          </div>
          <div className='md:col-span-2'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='pricing-type'>Pricing Type</Label>
                <Select
                  id='pricing-type'
                  value={panel.formState.pricing_type}
                  onChange={(e) =>
                    panel.setFormState((prev) => {
                      const nextType = e.target.value;
                      return {
                        ...prev,
                        pricing_type: nextType,
                        sessions_count:
                          nextType === 'per_sessions'
                            ? prev.sessions_count
                            : '',
                        free_trial_class_offered:
                          nextType === 'per_sessions'
                            ? prev.free_trial_class_offered
                            : false,
                        amount: nextType === 'free' ? '' : prev.amount,
                        currency:
                          nextType === 'free'
                            ? defaultCurrencyCode
                            : prev.currency,
                      };
                    })
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
                <div className='space-y-1'>
                  <Label htmlFor='pricing-sessions'>
                    Classes per term{' '}
                    <span className='ml-1'>{requiredIndicator}</span>
                  </Label>
                  <Input
                    id='pricing-sessions'
                    type='number'
                    min='1'
                    value={panel.formState.sessions_count}
                    onChange={(e) => {
                      markTouched('sessions_count');
                      panel.setFormState((prev) => ({
                        ...prev,
                        sessions_count: e.target.value,
                      }));
                    }}
                    className={showSessionsError ? errorInputClassName : ''}
                    aria-invalid={showSessionsError || undefined}
                  />
                  {showSessionsError ? (
                    <p className='text-xs text-red-600'>{sessionsError}</p>
                  ) : null}
                </div>
              )}
              {showFreeTrialToggle && (
                <div className='sm:col-span-2'>
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      id='pricing-free-trial'
                      type='checkbox'
                      checked={panel.formState.free_trial_class_offered}
                      onChange={(e) =>
                        panel.setFormState((prev) => ({
                          ...prev,
                          free_trial_class_offered: e.target.checked,
                        }))
                      }
                      className='h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500'
                    />
                    <span>Free trial class offered</span>
                  </label>
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
                  disabled={isFreeType}
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
                <Label htmlFor='pricing-amount'>
                  Amount
                  {!isFreeType ? (
                    <span className='ml-1'>{requiredIndicator}</span>
                  ) : null}
                </Label>
                <Input
                  id='pricing-amount'
                  type='number'
                  step='0.01'
                  value={panel.formState.amount}
                  disabled={isFreeType}
                  onChange={(e) => {
                    markTouched('amount');
                    panel.setFormState((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }));
                  }}
                  className={showAmountError ? errorInputClassName : ''}
                  aria-invalid={showAmountError || undefined}
                />
                {showAmountError ? (
                  <p className='text-xs text-red-600'>{amountError}</p>
                ) : null}
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
