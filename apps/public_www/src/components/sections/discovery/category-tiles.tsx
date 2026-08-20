'use client';

import type { Locale, SiteContent } from '@/content';
import { useSearchContext } from '@/components/shared/search/search-context';
import { homeWizardChoices, labelForLocale } from '@/lib/home-wizard/choices';
import { iconSrcForActivity } from '@/lib/home-wizard/choice-icons';

interface CategoryTilesProps {
  readonly locale: Locale;
  readonly copy: SiteContent['smallWorld']['categories'];
}

/**
 * Tactile category navigation: isometric 3D icons that lift and tilt on
 * hover. Selecting a tile toggles the matching activity-type filter so
 * the discovery carousels below update in place.
 */
export function CategoryTiles({ locale, copy }: CategoryTilesProps) {
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
    <section className="border-b border-brand-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-ink-900 sm:text-2xl">
          {copy.title}
        </h2>
        <p className="mt-1 text-sm text-ink-500">{copy.subtitle}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {homeWizardChoices.activityTypes.map((type) => {
            const isSelected = filters.activityTypeIds.includes(type.id);
            const label = labelForLocale(type.labels, locale);
            return (
              <button
                key={type.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleType(type.id)}
                className={`category-tile group flex flex-col items-center gap-3 rounded-2xl border px-4 pb-5 pt-6 transition ${
                  isSelected
                    ? 'border-accent-500 bg-brand-50 shadow-[0_10px_30px_rgba(29,64,59,0.12)]'
                    : 'border-brand-100 bg-white hover:border-brand-200 hover:shadow-[0_10px_30px_rgba(29,64,59,0.1)]'
                }`}
              >
                <img
                  src={iconSrcForActivity(type.id)}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                  className="category-tile__icon h-20 w-20 sm:h-24 sm:w-24"
                />
                <span
                  className={`text-sm font-semibold ${
                    isSelected ? 'text-brand-700' : 'text-ink-900'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
