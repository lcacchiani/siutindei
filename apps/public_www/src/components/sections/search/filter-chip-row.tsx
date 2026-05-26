'use client';

import type { Locale } from '@/content';
import { Chip } from '@/components/shared/ui/chip';
import { useSearchContext } from '@/components/shared/search/search-context';
import { homeWizardChoices, labelForLocale } from '@/lib/home-wizard/choices';

interface FilterChipRowProps {
  readonly locale: Locale;
}

export function FilterChipRow({ locale }: FilterChipRowProps) {
  const { filters, setFilters } = useSearchContext();

  function toggleType(typeId: string) {
    const next = new Set(filters.activityTypeIds);
    if (next.has(typeId)) {
      next.delete(typeId);
    } else {
      next.add(typeId);
    }
    setFilters({
      ...filters,
      activityTypeIds: [...next],
    });
  }

  return (
    <div className="border-b border-brand-100 bg-white">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        {homeWizardChoices.activityTypes.map((type) => (
          <Chip
            key={type.id}
            isSelected={filters.activityTypeIds.includes(type.id)}
            onClick={() => toggleType(type.id)}
          >
            {labelForLocale(type.labels, locale)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
