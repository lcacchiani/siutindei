'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { Locale, SiteContent } from '@/content';
import { FilterChipRow } from '@/components/sections/search/filter-chip-row';
import { SearchMapSplitLayout } from '@/components/sections/search/search-map-split-layout';
import { ListingGrid } from '@/components/sections/listings/listing-grid';
import { useSearchContext } from '@/components/shared/search/search-context';
import { Chip } from '@/components/shared/ui/chip';
import { fetchActivitySearch } from '@/lib/activities/search-client';
import { buildMapSearchHref } from '@/lib/activities/map-search-url';
import {
  buildSearchQueryString,
  filtersToApiParams,
  parseSearchFiltersFromQuery,
  parseSearchViewMode,
} from '@/lib/activities/search-params';
import { matchesTextQuery } from '@/lib/activities/listing-utils';
import { listingsWithCoordinates } from '@/lib/google-maps/coordinates';
import { isGoogleMapsEnabled } from '@/lib/google-maps/config';
import { localizePath } from '@/lib/locale-routing';
import type { ActivityListing } from '@/lib/activities/types';

interface SearchResultsPageProps {
  readonly locale: Locale;
  readonly copy: SiteContent['searchPage'];
}

export function SearchResultsPage({ locale, copy }: SearchResultsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters, setFilters } = useSearchContext();
  const [listings, setListings] = useState<readonly ActivityListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState(filters.textQuery);

  const urlFilters = useMemo(
    () => parseSearchFiltersFromQuery(searchParams),
    [searchParams],
  );
  const urlViewMode = useMemo(
    () => parseSearchViewMode(searchParams),
    [searchParams],
  );
  const mapsEnabled = isGoogleMapsEnabled();
  const showMapSplit = mapsEnabled && urlViewMode === 'map';

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

  useEffect(() => {
    if (!showMapSplit || visibleListings.length === 0) {
      return;
    }
    if (
      selectedId &&
      visibleListings.some((listing) => listing.activity.id === selectedId)
    ) {
      return;
    }
    const firstMappable = listingsWithCoordinates(visibleListings)[0];
    setSelectedId(
      firstMappable?.activity.id ?? visibleListings[0]?.activity.id ?? null,
    );
  }, [selectedId, showMapSplit, visibleListings]);

  function navigateToListView() {
    const query = buildSearchQueryString(urlFilters);
    const path = localizePath('/search', locale);
    router.push(query ? `${path}?${query}` : path);
  }

  function navigateToMapView() {
    router.push(buildMapSearchHref(locale, urlFilters));
  }

  return (
    <div className="bg-white">
      <h1 className="sr-only">{copy.pageTitle}</h1>
      <FilterChipRow locale={locale} />
      <div className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          {mapsEnabled ? (
            <div className="flex gap-2">
              <Chip isSelected={!showMapSplit} onClick={navigateToListView}>
                {copy.listViewLabel}
              </Chip>
              <Chip isSelected={showMapSplit} onClick={navigateToMapView}>
                {copy.mapViewLabel}
              </Chip>
            </div>
          ) : null}
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
      {errorMessage ? (
        <p className="mx-auto max-w-7xl px-4 py-6 text-center text-red-700">
          {errorMessage}
        </p>
      ) : null}
      {showMapSplit ? (
        <SearchMapSplitLayout
          locale={locale}
          copy={copy}
          listings={visibleListings}
          selectedId={selectedId}
          onSelect={setSelectedId}
          isLoading={isLoading}
        />
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <ListingGrid
            locale={locale}
            listings={visibleListings}
            isLoading={isLoading}
            labels={{
              freeTrial: copy.freeTrialLabel,
              imageFallback: copy.imageFallbackLabel,
              mapAlt: copy.mapAltLabel,
              empty: copy.emptyLabel,
            }}
          />
        </div>
      )}
    </div>
  );
}
