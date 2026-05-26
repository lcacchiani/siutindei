'use client';

import type { Locale } from '@/content';
import type { ActivityListing } from '@/lib/activities/types';
import { listingTitle } from '@/lib/activities/listing-utils';

interface SearchMapPanelProps {
  readonly locale: Locale;
  readonly listings: readonly ActivityListing[];
  readonly selectedId: string | null;
  readonly onSelect: (activityId: string) => void;
  readonly emptyLabel: string;
}

interface MapPoint {
  readonly listing: ActivityListing;
  readonly x: number;
  readonly y: number;
}

function buildMapPoints(listings: readonly ActivityListing[]): readonly MapPoint[] {
  const withCoords = listings.filter(
    (listing) =>
      listing.location.lat !== null && listing.location.lng !== null,
  );
  if (withCoords.length === 0) {
    return [];
  }

  const lats = withCoords.map((item) => item.location.lat as number);
  const lngs = withCoords.map((item) => item.location.lng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return withCoords.map((listing) => {
    const lat = listing.location.lat as number;
    const lng = listing.location.lng as number;
    const latSpan = maxLat - minLat || 1;
    const lngSpan = maxLng - minLng || 1;
    return {
      listing,
      x: ((lng - minLng) / lngSpan) * 88 + 6,
      y: (1 - (lat - minLat) / latSpan) * 78 + 8,
    };
  });
}

export function SearchMapPanel({
  locale,
  listings,
  selectedId,
  onSelect,
  emptyLabel,
}: SearchMapPanelProps) {
  const points = buildMapPoints(listings);

  if (points.length === 0) {
    return (
      <div className="search-map-panel__canvas flex items-center justify-center px-4 text-center text-sm text-ink-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="search-map-panel__canvas">
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        role="application"
        aria-label="Activity locations"
      >
        {points.map((point) => {
          const isSelected = selectedId === point.listing.activity.id;
          const title = listingTitle(locale, point.listing);
          return (
            <g key={point.listing.activity.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isSelected ? 3.2 : 2.4}
                className={
                  isSelected
                    ? 'fill-accent-500 stroke-white'
                    : 'fill-white stroke-brand-500'
                }
                strokeWidth="0.8"
                tabIndex={0}
                role="button"
                aria-label={title}
                onClick={() => onSelect(point.listing.activity.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(point.listing.activity.id);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>
      <ul className="mt-4 space-y-2 lg:hidden">
        {points.map((point) => (
          <li key={point.listing.activity.id}>
            <button
              type="button"
              className="text-left text-sm font-medium text-brand-600 hover:underline"
              onClick={() => onSelect(point.listing.activity.id)}
            >
              {listingTitle(locale, point.listing)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
