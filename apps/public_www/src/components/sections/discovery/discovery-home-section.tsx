'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Locale, SiteContent } from '@/content';
import { useSearchContext } from '@/components/shared/search/search-context';
import { ListingCarouselSection } from '@/components/sections/listings/listing-carousel-section';
import { logActivityLoadError } from '@/lib/activities/load-error';
import { fetchActivitySearch } from '@/lib/activities/search-client';
import {
  filtersToApiParams,
  type SearchFiltersState,
} from '@/lib/activities/search-params';
import {
  groupListingsByRegion,
  matchesTextQuery,
  sortListingsForDiscovery,
} from '@/lib/activities/listing-utils';
import { loadRecentSearch, loadRecentViewedIds } from '@/lib/activities/recent-storage';
import type { ActivityListing } from '@/lib/activities/types';
import { homeWizardChoices, labelForLocale } from '@/lib/home-wizard/choices';

interface DiscoveryHomeSectionProps {
  readonly locale: Locale;
  readonly copy: SiteContent['discovery'];
}

async function fetchDiscoveryListings(
  locale: Locale,
  filters: SearchFiltersState,
): Promise<readonly ActivityListing[]> {
  const apiParams = filtersToApiParams(filters);
  const response = await fetchActivitySearch({
    ...apiParams,
    limit: 120,
  });
  return sortListingsForDiscovery(
    response.items.filter((listing) =>
      matchesTextQuery(listing, locale, filters.textQuery),
    ),
  );
}

export function DiscoveryHomeSection({ locale, copy }: DiscoveryHomeSectionProps) {
  const { filters } = useSearchContext();
  const [listings, setListings] = useState<readonly ActivityListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    fetchDiscoveryListings(locale, filters)
      .then((items) => {
        if (!cancelled) {
          setListings(items);
        }
      })
      .catch((error: unknown) => {
        logActivityLoadError('discovery home', error);
        if (!cancelled) {
          setErrorMessage(copy.errorLabel);
          setListings([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [copy.errorLabel, filters, locale]);

  const recentSearchFilters = useMemo(() => loadRecentSearch(), []);
  const [recentListings, setRecentListings] = useState<readonly ActivityListing[]>(
    [],
  );

  useEffect(() => {
    if (!recentSearchFilters) {
      return;
    }
    fetchDiscoveryListings(locale, recentSearchFilters)
      .then((items) => setRecentListings(items.slice(0, 12)))
      .catch(() => setRecentListings([]));
  }, [locale, recentSearchFilters]);

  const viewedIds = useMemo(() => loadRecentViewedIds(), []);
  const viewedListings = useMemo(
    () =>
      listings.filter((listing) => viewedIds.includes(listing.activity.id)).slice(0, 12),
    [listings, viewedIds],
  );

  const popularListings = useMemo(
    () => listings.slice(0, 12),
    [listings],
  );

  const regionGroups = useMemo(
    () => groupListingsByRegion(listings),
    [listings],
  );

  const cardLabels = {
    previous: copy.carousel.previousLabel,
    next: copy.carousel.nextLabel,
    freeTrial: copy.freeTrialLabel,
    imageFallback: copy.imageFallbackLabel,
  };

  if (errorMessage) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-12 text-center text-red-700">
        {errorMessage}
      </p>
    );
  }

  return (
    <div className="bg-white">
      {recentListings.length > 0 ? (
        <ListingCarouselSection
          locale={locale}
          title={copy.continueSearchingTitle}
          listings={recentListings}
          isLoading={false}
          labels={cardLabels}
        />
      ) : null}
      {viewedListings.length > 0 ? (
        <ListingCarouselSection
          locale={locale}
          title={copy.recentlyViewedTitle}
          listings={viewedListings}
          isLoading={false}
          labels={cardLabels}
        />
      ) : null}
      <ListingCarouselSection
        locale={locale}
        title={copy.popularTitle}
        listings={popularListings}
        isLoading={isLoading}
        labels={cardLabels}
      />
      {[...regionGroups.entries()].map(([regionKey, regionListings]) => {
        const region = homeWizardChoices.regions.find(
          (entry) => entry.areaId === regionKey,
        );
        const title = region
          ? `${copy.nearRegionTitle} ${labelForLocale(region.labels, locale)}`
          : copy.nearRegionTitle;
        return (
          <ListingCarouselSection
            key={regionKey}
            locale={locale}
            title={title}
            listings={regionListings.slice(0, 12)}
            isLoading={isLoading}
            labels={cardLabels}
          />
        );
      })}
    </div>
  );
}
