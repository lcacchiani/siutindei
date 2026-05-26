'use client';

import type { Locale } from '@/content';
import { useSearchContext } from '@/components/shared/search/search-context';
import { homeWizardChoices, labelForLocale } from '@/lib/home-wizard/choices';
import {
  areaIdForRegion,
  searchAgeForGroup,
} from '@/lib/activities/search-params';

interface SearchBarCompactProps {
  readonly locale: Locale;
  readonly labels: {
    readonly where: string;
    readonly childAge: string;
    readonly activityTypes: string;
    readonly search: string;
    readonly anywhere: string;
    readonly anyAge: string;
    readonly anyType: string;
  };
}

function summarizeTypes(
  locale: Locale,
  typeIds: readonly string[],
): string {
  if (typeIds.length === 0) {
    return '';
  }
  const labels = typeIds
    .map((id) => {
      const match = homeWizardChoices.activityTypes.find(
        (entry) => entry.id === id,
      );
      return match ? labelForLocale(match.labels, locale) : null;
    })
    .filter((value): value is string => Boolean(value));
  if (labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    return labels[0];
  }
  return `${labels[0]} +${labels.length - 1}`;
}

export function SearchBarCompact({ locale, labels }: SearchBarCompactProps) {
  const { filters, openSearch } = useSearchContext();

  const region = homeWizardChoices.regions.find(
    (entry) => entry.id === filters.regionId,
  );
  const ageGroup = homeWizardChoices.ageGroups.find(
    (entry) => entry.id === filters.ageGroupId,
  );

  const whereLabel = region
    ? labelForLocale(region.labels, locale)
    : labels.anywhere;
  const ageLabel = ageGroup
    ? labelForLocale(ageGroup.labels, locale)
    : labels.anyAge;
  const typesLabel =
    summarizeTypes(locale, filters.activityTypeIds) || labels.anyType;

  const hasArea = Boolean(areaIdForRegion(filters.regionId));
  const hasAge = Boolean(searchAgeForGroup(filters.ageGroupId));

  return (
    <button
      type="button"
      onClick={openSearch}
      className="search-bar-compact flex w-full max-w-3xl items-center rounded-full border border-ink-900/15 bg-white py-1 pl-4 pr-1 shadow-sm transition hover:shadow-md"
      aria-label={labels.search}
    >
      <span className="hidden min-w-0 flex-1 grid-cols-3 divide-x divide-ink-900/10 md:grid">
        <span className="truncate px-3 py-2 text-left">
          <span className="block text-xs font-semibold text-ink-900">
            {labels.where}
          </span>
          <span className="block truncate text-sm text-ink-500">
            {whereLabel}
          </span>
        </span>
        <span className="truncate px-3 py-2 text-left">
          <span className="block text-xs font-semibold text-ink-900">
            {labels.childAge}
          </span>
          <span className="block truncate text-sm text-ink-500">{ageLabel}</span>
        </span>
        <span className="truncate px-3 py-2 text-left">
          <span className="block text-xs font-semibold text-ink-900">
            {labels.activityTypes}
          </span>
          <span className="block truncate text-sm text-ink-500">
            {typesLabel}
          </span>
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm text-ink-700 md:hidden">
        {[whereLabel, ageLabel, typesLabel]
          .filter((value, index) => {
            if (index === 0) {
              return hasArea || !hasAge;
            }
            return true;
          })
          .join(' · ')}
      </span>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500 text-lg text-white">
        ⌕
      </span>
    </button>
  );
}
