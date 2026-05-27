'use client';

import type { ActivityListing } from '@/lib/activities/types';
import { listingCoordinate } from '@/lib/google-maps/coordinates';
import {
  getGoogleMapsConfig,
  isGoogleMapsEnabled,
} from '@/lib/google-maps/config';
import { buildStaticMapUrl } from '@/lib/google-maps/static-map-url';
import { listingTitle } from '@/lib/activities/listing-utils';
import type { Locale } from '@/content';

interface ListingCardMiniMapProps {
  readonly locale: Locale;
  readonly listing: ActivityListing;
  readonly mapAltLabel: string;
}

export function ListingCardMiniMap({
  locale,
  listing,
  mapAltLabel,
}: ListingCardMiniMapProps) {
  if (!isGoogleMapsEnabled()) {
    return null;
  }

  const coordinate = listingCoordinate(listing);
  if (!coordinate) {
    return null;
  }

  const { apiKey } = getGoogleMapsConfig();
  const mapUrl = buildStaticMapUrl({
    apiKey,
    coordinate,
    variant: 'card',
    zoom: 15,
  });
  const title = listingTitle(locale, listing);

  return (
    <div className="listing-card-mini-map pointer-events-none absolute inset-x-0 bottom-0 h-[38%] overflow-hidden rounded-b-xl border-t border-white/80">
      <img
        src={mapUrl}
        alt={`${mapAltLabel}: ${title}`}
        width={600}
        height={200}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
