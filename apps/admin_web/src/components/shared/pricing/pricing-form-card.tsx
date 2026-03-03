'use client';

import type { ReactElement } from 'react';

import type { Activity, Location } from '../../../types/admin';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select } from '../../ui/select';
import { StatusBanner } from '../../status-banner';
import type { CurrencyOption, PricingFormState } from './pricing-types';

interface PricingFormCardProps {
  error: string;
  formState: PricingFormState;
  locations: Location[];
  activities: Activity[];
  currencyOptions: CurrencyOption[];
  pricingOptions: Array<{ value: string; label: string }>;
  requiredIndicator: ReactElement;
  errorInputClassName: string;
  isFreeType: boolean;
  showSessionsField: boolean;
  showFreeTrialToggle: boolean;
  showLocationError: boolean;
  showActivityError: boolean;
  showAmountError: boolean;
  showSessionsError: boolean;
  locationError: string;
  activityError: string;
  amountError: string;
  sessionsError: string;
  isSaving: boolean;
  editingId: string | null;
  onLocationChange: (value: string) => void;
  onActivityChange: (value: string) => void;
  onPricingTypeChange: (value: string) => void;
  onSessionsChange: (value: string) => void;
  onFreeTrialToggle: (value: boolean) => void;
  onCurrencyChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PricingFormCard({
  error,
  formState,
  locations,
  activities,
  currencyOptions,
  pricingOptions,
  requiredIndicator,
  errorInputClassName,
  isFreeType,
  showSessionsField,
  showFreeTrialToggle,
  showLocationError,
  showActivityError,
  showAmountError,
  showSessionsError,
  locationError,
  activityError,
  amountError,
  sessionsError,
  isSaving,
  editingId,
  onLocationChange,
  onActivityChange,
  onPricingTypeChange,
  onSessionsChange,
  onFreeTrialToggle,
  onCurrencyChange,
  onAmountChange,
  onSubmit,
  onCancel,
}: PricingFormCardProps) {
  return (
    <Card title='Pricing' description='Manage pricing entries.'>
      {error && (
        <div className='mb-4'>
          <StatusBanner variant='error' title='Error'>
            {error}
          </StatusBanner>
        </div>
      )}
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='space-y-1'>
          <Label htmlFor='pricing-location'>
            Location <span className='ml-1'>{requiredIndicator}</span>
          </Label>
          <Select
            id='pricing-location'
            value={formState.location_id}
            onChange={(e) => onLocationChange(e.target.value)}
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
            Activity <span className='ml-1'>{requiredIndicator}</span>
          </Label>
          <Select
            id='pricing-activity'
            value={formState.activity_id}
            onChange={(e) => onActivityChange(e.target.value)}
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
                value={formState.pricing_type}
                onChange={(e) => onPricingTypeChange(e.target.value)}
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
                  Classes per term <span className='ml-1'>{requiredIndicator}</span>
                </Label>
                <Input
                  id='pricing-sessions'
                  type='number'
                  min='1'
                  value={formState.sessions_count}
                  onChange={(e) => onSessionsChange(e.target.value)}
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
                    checked={formState.free_trial_class_offered}
                    onChange={(e) => onFreeTrialToggle(e.target.checked)}
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
                value={formState.currency}
                disabled={isFreeType}
                onChange={(e) => onCurrencyChange(e.target.value)}
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
                value={formState.amount}
                disabled={isFreeType}
                onChange={(e) => onAmountChange(e.target.value)}
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
        <Button type='button' onClick={onSubmit} disabled={isSaving}>
          {editingId ? 'Update Pricing' : 'Add Pricing'}
        </Button>
        {editingId && (
          <Button
            type='button'
            variant='secondary'
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
