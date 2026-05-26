'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Locale } from '@/content';
import { Button } from '@/components/shared/ui/button';
import { Chip } from '@/components/shared/ui/chip';
import { Modal } from '@/components/shared/ui/modal';
import { useSearchContext } from '@/components/shared/search/search-context';
import { saveRecentSearch } from '@/lib/activities/recent-storage';
import {
  buildSearchQueryString,
  type SearchFiltersState,
} from '@/lib/activities/search-params';
import { homeWizardChoices, labelForLocale } from '@/lib/home-wizard/choices';
import { localizePath } from '@/lib/locale-routing';

interface SearchPanelCopy {
  readonly title: string;
  readonly whereLabel: string;
  readonly childAgeLabel: string;
  readonly activityTypesLabel: string;
  readonly searchLabel: string;
  readonly clearTypesLabel: string;
}

interface SearchPanelProps {
  readonly locale: Locale;
  readonly copy: SearchPanelCopy;
}

export function SearchPanel({ locale, copy }: SearchPanelProps) {
  const router = useRouter();
  const { filters, isSearchOpen, setFilters, closeSearch } = useSearchContext();
  const [draft, setDraft] = useState<SearchFiltersState>(filters);

  useEffect(() => {
    if (isSearchOpen) {
      setDraft(filters);
    }
  }, [filters, isSearchOpen]);

  function updateDraft(partial: Partial<SearchFiltersState>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function toggleType(typeId: string) {
    setDraft((current) => {
      const next = new Set(current.activityTypeIds);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return {
        ...current,
        activityTypeIds: [...next],
      };
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFilters(draft);
    saveRecentSearch(draft);
    closeSearch();
    const query = buildSearchQueryString(draft);
    const path = localizePath('/search', locale);
    router.push(query ? `${path}?${query}` : path);
  }

  return (
    <Modal isOpen={isSearchOpen} title={copy.title} onClose={closeSearch}>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-900">
            {copy.whereLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            <Chip
              isSelected={draft.regionId === null}
              onClick={() => updateDraft({ regionId: null })}
            >
              {locale === 'zh-HK' ? '全港' : 'All Hong Kong'}
            </Chip>
            {homeWizardChoices.regions.map((region) => (
              <Chip
                key={region.id}
                isSelected={draft.regionId === region.id}
                onClick={() => updateDraft({ regionId: region.id })}
              >
                {labelForLocale(region.labels, locale)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-900">
            {copy.childAgeLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {homeWizardChoices.ageGroups.map((group) => (
              <Chip
                key={group.id}
                isSelected={draft.ageGroupId === group.id}
                onClick={() => updateDraft({ ageGroupId: group.id })}
              >
                {labelForLocale(group.labels, locale)}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-900">
            {copy.activityTypesLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {homeWizardChoices.activityTypes.map((type) => (
              <Chip
                key={type.id}
                isSelected={draft.activityTypeIds.includes(type.id)}
                onClick={() => toggleType(type.id)}
              >
                {labelForLocale(type.labels, locale)}
              </Chip>
            ))}
          </div>
          {draft.activityTypeIds.length > 0 ? (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-brand-600 underline-offset-2 hover:underline"
              onClick={() => updateDraft({ activityTypeIds: [] })}
            >
              {copy.clearTypesLabel}
            </button>
          ) : null}
        </fieldset>
        <Button type="submit" className="w-full">
          {copy.searchLabel}
        </Button>
      </form>
    </Modal>
  );
}
