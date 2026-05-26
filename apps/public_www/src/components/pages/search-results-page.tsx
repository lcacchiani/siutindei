'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type { Locale, SiteContent } from '@/content';
import { FilterChipRow } from '@/components/sections/search/filter-chip-row';
import { SearchMapPanel } from '@/components/sections/search/search-map-panel';
import { ListingGrid } from '@/components/sections/listings/listing-grid';
import { useSearchContext } from '@/components/shared/search/search-context';
import { Chip } from '@/components/shared/ui/chip';
import { fetchActivitySearch } from '@/lib/activities/search-client';
import {
  filtersToApiParams,
  parseSearchFiltersFromQuery,
} from '@/lib/activities/search-params';
import { matchesTextQuery } from '@/lib/activities/listing-utils';
import type { ActivityListing } from '@/lib/activities/types';

interface SearchResultsPageProps {
  readonly locale: Locale;
  readonly copy: SiteContent['searchPage'];
}

export function SearchResultsPage({ locale, copy }: SearchResultsPageProps) {
  const searchParams = useSearchParams();
  const { filters, setFilters } = useSearchContext();
  const [listings, setListings] = useState<readonly ActivityListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState(filters.textQuery);

  const urlFilters = useMemo(
    () => parseSearchFiltersFromQuery(searchParams),
    [searchParams],
  );

  useEffect(() => {
    setFilters(urlFilters);
    setTextQuery(urlFilters.textQuery);
  }, [setFilters, urlFilters]);

  const loadResults = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const apiParams = filtersToApiParams(urlFilters);
      const response = await fetchActivitySearch({
        ...apiParams,
        limit: 200,
      });
      const filtered = response.items.filter((listing) =>
        matchesTextQuery(listing, locale, urlFilters.textQuery),
      );
      setListings(filtered);
    } catch {
      setErrorMessage(copy.errorLabel);
      setListings([]);
    } finally {
      setIsLoading(false);
    }
  }, [copy.errorLabel, locale, urlFilters]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const visibleListings = useMemo(() => {
    if (!textQuery.trim()) {
      return listings;
    }
    return listings.filter((listing) =>
      matchesTextQuery(listing, locale, textQuery),
    );
  }, [listings, locale, textQuery]);

  return (
    <div className="bg-white">
      <FilterChipRow locale={locale} />
      <div className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex gap-2">
            <Chip
              isSelected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              {copy.listViewLabel}
            </Chip>
            <Chip
              isSelected={viewMode === 'map'}
              onClick={() => setViewMode('map')}
            >
              {copy.mapViewLabel}
            </Chip>
          </div>
          <label className="min-w-[220px] flex-1">
            <span className="sr-only">{copy.textFilterLabel}</span>
            <input
              type="search"
              value={textQuery}
              onChange={(event) => setTextQuery(event.target.value)}
              placeholder={copy.textFilterPlaceholder}
              className="w-full rounded-full border border-ink-900/15 px-4 py-2 text-sm"
            />
          </label>
          <p className="text-sm text-ink-500">
            {copy.resultsCountLabel.replace(
              '{count}',
              String(visibleListings.length),
            )}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {errorMessage ? (
          <p className="mb-6 text-center text-red-700">{errorMessage}</p>
        ) : null}
        {viewMode === 'map' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <SearchMapPanel
              locale={locale}
              listings={visibleListings}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyLabel={copy.mapEmptyLabel}
            />
            <ListingGrid
              locale={locale}
              listings={
                selectedId
                  ? visibleListings.filter(
                      (listing) => listing.activity.id === selectedId,
                    )
                  : visibleListings
              }
              isLoading={isLoading}
              labels={{
                freeTrial: copy.freeTrialLabel,
                imageFallback: copy.imageFallbackLabel,
                empty: copy.emptyLabel,
              }}
            />
          </div>
        ) : (
          <ListingGrid
            locale={locale}
            listings={visibleListings}
            isLoading={isLoading}
            labels={{
              freeTrial: copy.freeTrialLabel,
              imageFallback: copy.imageFallbackLabel,
              empty: copy.emptyLabel,
            }}
          />
        )}
      </div>
    </div>
  );
}
