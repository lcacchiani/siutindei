'use client';

import Link from 'next/link';

import type { Locale } from '@/content';
import type { ActivityListing } from '@/lib/activities/types';
import {
  formatListingPrice,
  listingImageUrl,
  listingTitle,
  regionLabelForListing,
} from '@/lib/activities/listing-utils';
import { localizePath } from '@/lib/locale-routing';
import {
  LISTING_IMAGE_HEIGHT,
  LISTING_IMAGE_WIDTH,
} from '@/lib/listing-image';

interface SearchMapListItemProps {
  readonly locale: Locale;
  readonly listing: ActivityListing;
  readonly isSelected: boolean;
  readonly imageFallbackLabel: string;
  readonly onSelect: () => void;
}

export function SearchMapListItem({
  locale,
  listing,
  isSelected,
  imageFallbackLabel,
  onSelect,
}: SearchMapListItemProps) {
  const href = `${localizePath('/activity', locale)}?id=${listing.activity.id}`;
  const imageUrl = listingImageUrl(listing);
  const title = listingTitle(locale, listing);
  const region = regionLabelForListing(locale, listing);
  const price = formatListingPrice(locale, listing);

  return (
    <article
      className={`search-map-list-item flex gap-3 rounded-xl border p-3 transition ${
        isSelected
          ? 'border-brand-500 bg-brand-50'
          : 'border-brand-100 bg-white hover:border-brand-200'
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 gap-3 text-left"
        onClick={onSelect}
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              width={LISTING_IMAGE_WIDTH}
              height={LISTING_IMAGE_HEIGHT}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-ink-500">
              {imageFallbackLabel}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-ink-900">
            {title}
          </h3>
          {region ? (
            <p className="mt-1 text-xs text-ink-500">{region}</p>
          ) : null}
          <p className="mt-1 text-sm font-semibold text-ink-900">{price}</p>
        </div>
      </button>
      <Link
        href={href}
        className="self-center text-xs font-semibold text-brand-600 hover:underline"
      >
        →
      </Link>
    </article>
  );
}
