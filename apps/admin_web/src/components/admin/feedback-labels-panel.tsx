'use client';

import { useMemo, useState } from 'react';

import { useResourcePanel } from '../../hooks/use-resource-panel';
import {
  buildTranslationsPayload,
  emptyTranslations,
  extractTranslations,
  type LanguageCode,
  type TranslationLanguageCode,
} from '../../lib/translations';
import type { FeedbackLabel } from '../../types/admin';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataTable } from '../ui/data-table';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { LanguageToggleInput } from '../ui/language-toggle-input';
import { SearchInput } from '../ui/search-input';
import { StatusBanner } from '../status-banner';

interface FeedbackLabelFormState {
  name: string;
  name_translations: Record<TranslationLanguageCode, string>;
  display_order: string;
}

const emptyForm: FeedbackLabelFormState = {
  name: '',
  name_translations: emptyTranslations(),
  display_order: '0',
};

function itemToForm(item: FeedbackLabel): FeedbackLabelFormState {
  return {
    name: item.name ?? '',
    name_translations: extractTranslations(item.name_translations),
    display_order:
      item.display_order !== undefined ? `${item.display_order}` : '0',
  };
}

function parseDisplayOrder(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

export function FeedbackLabelsPanel() {
  const panel = useResourcePanel<FeedbackLabel, FeedbackLabelFormState>(
    'feedback-labels',
    'admin',
    emptyForm,
    itemToForm
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [touchedState, setTouchedState] = useState<{
    key: string;
    fields: Record<string, boolean>;
  }>({ key: '', fields: {} });
  const [submittedState, setSubmittedState] = useState<{
    key: string;
    value: boolean;
  }>({ key: '', value: false });

  const isFormEmpty =
    panel.formState.name.trim() === '' &&
    panel.formState.display_order.trim() === emptyForm.display_order &&
    Object.values(panel.formState.name_translations).every(
      (value) => !value.trim()
    );

  const formKey = panel.editingId ?? 'new';
  const activeTouchedFields =
    isFormEmpty || touchedState.key !== formKey ? {} : touchedState.fields;
  const hasSubmitted =
    isFormEmpty || submittedState.key !== formKey ? false : submittedState.value;

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
    Boolean(message && (hasSubmitted || activeTouchedFields[field]));

  const validate = () => {
    if (!panel.formState.name.trim()) {
      return 'Name is required.';
    }
    const order = parseDisplayOrder(panel.formState.display_order);
    if (order === null || order < 0) {
      return 'Display order must be a valid number.';
    }
    return null;
  };

  const nameError = panel.formState.name.trim()
    ? ''
    : 'Enter a label name.';
  const displayOrderError = useMemo(() => {
    const order = parseDisplayOrder(panel.formState.display_order);
    if (order === null || order < 0) {
      return 'Display order must be a whole number.';
    }
    return '';
  }, [panel.formState.display_order]);

  const handleNameChange = (language: LanguageCode, value: string) => {
    markTouched('name');
    panel.setFormState((prev) =>
      language === 'en'
        ? { ...prev, name: value }
        : {
            ...prev,
            name_translations: {
              ...prev.name_translations,
              [language]: value,
            },
          }
    );
  };

  const formToPayload = (form: FeedbackLabelFormState) => ({
    name: form.name.trim(),
    name_translations: buildTranslationsPayload(form.name_translations),
    display_order: parseDisplayOrder(form.display_order),
  });

  const handleSubmit = () => {
    setSubmittedState({ key: formKey, value: true });
    return panel.handleSubmit(formToPayload, validate);
  };

  const filteredItems = panel.items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const translations = Object.values(item.name_translations ?? {})
      .join(' ')
      .toLowerCase();
    return (
      item.name.toLowerCase().includes(query) || translations.includes(query)
    );
  });

  const showNameError = shouldShowError('name', nameError);
  const showDisplayOrderError = shouldShowError(
    'display_order',
    displayOrderError
  );

  const columns = [
    {
      key: 'name',
      header: 'Label',
      primary: true,
      render: (item: FeedbackLabel) => item.name,
    },
    {
      key: 'translations',
      header: 'Translations',
      render: (item: FeedbackLabel) => {
        const translations = Object.entries(item.name_translations ?? {})
          .map(([lang, value]) => `${lang}: ${value}`)
          .join(', ');
        return (
          <span className='text-xs text-slate-500'>
            {translations || '—'}
          </span>
        );
      },
    },
    {
      key: 'display-order',
      header: 'Order',
      render: (item: FeedbackLabel) => (
        <span className='text-slate-600'>
          {item.display_order ?? 0}
        </span>
      ),
    },
  ];

  return (
    <div className='space-y-6'>
      <Card
        title={panel.editingId ? 'Edit Feedback Label' : 'New Feedback Label'}
        description='Define the labels users can attach to feedback.'
      >
        {panel.error && (
          <div className='mb-4'>
            <StatusBanner variant='error' title='Error'>
              {panel.error}
            </StatusBanner>
          </div>
        )}

        <div className='space-y-4'>
          <div className='space-y-1'>
            <LanguageToggleInput
              id='label-name'
              label='Label Name'
              required
              values={{
                en: panel.formState.name,
                zh: panel.formState.name_translations.zh,
                yue: panel.formState.name_translations.yue,
              }}
              onChange={handleNameChange}
              hasError={showNameError}
              inputClassName={showNameError ? errorInputClassName : ''}
            />
            {showNameError ? (
              <p className='text-xs text-red-600'>{nameError}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor='display-order'>Display Order</Label>
            <Input
              id='display-order'
              type='number'
              value={panel.formState.display_order}
              onChange={(e) => {
                markTouched('display_order');
                panel.setFormState((prev) => ({
                  ...prev,
                  display_order: e.target.value,
                }));
              }}
              onBlur={() => markTouched('display_order')}
              className={showDisplayOrderError ? errorInputClassName : ''}
              aria-invalid={showDisplayOrderError || undefined}
            />
            {showDisplayOrderError ? (
              <p className='text-xs text-red-600'>{displayOrderError}</p>
            ) : null}
          </div>

          <div className='flex flex-wrap gap-2 pt-2'>
            <Button
              type='button'
              variant='primary'
              onClick={handleSubmit}
              disabled={panel.isSaving}
            >
              {panel.isSaving ? 'Saving...' : 'Save Label'}
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
        title='Feedback Labels'
        description='Manage the labels available to end users.'
      >
        <div className='mb-4 max-w-sm'>
          <SearchInput
            placeholder='Search labels...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          onEdit={panel.startEdit}
          onDelete={panel.handleDelete}
          nextCursor={panel.nextCursor}
          onLoadMore={panel.loadMore}
          isLoading={panel.isLoading}
          emptyMessage='No feedback labels found.'
        />
      </Card>
    </div>
  );
}
