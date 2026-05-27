'use client';

import type { Locale, SiteContent } from '@/content';
import { ActivityGoogleMap } from '@/components/shared/maps/activity-google-map';
import { isGoogleMapsEnabled } from '@/lib/google-maps/config';
import { listingsWithCoordinates } from '@/lib/google-maps/coordinates';
import type { ActivityListing } from '@/lib/activities/types';

import { SearchMapListItem } from './search-map-list-item';

interface SearchMapSplitLayoutProps {
  readonly locale: Locale;
  readonly copy: SiteContent['searchPage'];
  readonly listings: readonly ActivityListing[];
  readonly selectedId: string | null;
  readonly onSelect: (activityId: string) => void;
  readonly isLoading: boolean;
}

export function SearchMapSplitLayout({
  locale,
  copy,
  listings,
  selectedId,
  onSelect,
  isLoading,
}: SearchMapSplitLayoutProps) {
  const mappableCount = listingsWithCoordinates(listings).length;
  const mapsEnabled = isGoogleMapsEnabled();

  if (!mapsEnabled) {
    return (
      <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-8 text-center text-ink-700">
        {copy.mapUnavailableLabel}
      </p>
    );
  }

  return (
    <div className="search-map-split-layout lg:grid lg:grid-cols-2 lg:gap-0">
      <div className="search-map-split-layout__list max-h-[50vh] overflow-y-auto border-b border-brand-100 px-4 py-4 lg:max-h-[calc(100vh-12rem)] lg:border-b-0 lg:border-r">
        {isLoading ? (
          <p className="text-center text-sm text-ink-500">{copy.loadingMapLabel}</p>
        ) : null}
        {!isLoading && listings.length === 0 ? (
          <p className="text-center text-sm text-ink-700">{copy.emptyLabel}</p>
        ) : null}
        {!isLoading && listings.length > 0 && mappableCount === 0 ? (
          <p className="text-center text-sm text-ink-700">{copy.mapEmptyLabel}</p>
        ) : null}
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.activity.id}>
              <SearchMapListItem
                locale={locale}
                listing={listing}
                isSelected={selectedId === listing.activity.id}
                imageFallbackLabel={copy.imageFallbackLabel}
                onSelect={() => onSelect(listing.activity.id)}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="search-map-split-layout__map sticky top-16 h-[50vh] lg:h-[calc(100vh-12rem)]">
        {mappableCount > 0 ? (
          <ActivityGoogleMap
            locale={locale}
            listings={listings}
            selectedId={selectedId}
            onSelect={onSelect}
            className="h-full w-full"
            ariaLabel={copy.mapAriaLabel}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-50 px-4 text-center text-sm text-ink-500">
            {copy.mapEmptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
