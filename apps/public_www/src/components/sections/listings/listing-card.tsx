'use client';

import Link from 'next/link';

import type { Locale } from '@/content';
import type { ActivityListing } from '@/lib/activities/types';
import {
  formatListingPrice,
  formatScheduleSnippet,
  listingImageUrl,
  listingOrgName,
  listingTitle,
  regionLabelForListing,
} from '@/lib/activities/listing-utils';
import {
  LISTING_IMAGE_HEIGHT,
  LISTING_IMAGE_WIDTH,
} from '@/lib/listing-image';
import { localizePath } from '@/lib/locale-routing';

interface ListingCardProps {
  readonly locale: Locale;
  readonly listing: ActivityListing;
  readonly freeTrialLabel: string;
  readonly imageAltFallback: string;
  readonly layout?: 'carousel' | 'grid';
  readonly imageLoading?: 'lazy' | 'eager';
  readonly imageFetchPriority?: 'high' | 'low';
  readonly deferRendering?: boolean;
}

export function ListingCard({
  locale,
  listing,
  freeTrialLabel,
  imageAltFallback,
  layout = 'carousel',
  imageLoading = 'lazy',
  imageFetchPriority,
  deferRendering = false,
}: ListingCardProps) {
  const widthClassName =
    layout === 'grid' ? 'w-full' : 'w-[280px] shrink-0 sm:w-[300px]';
  const deferClassName = deferRendering ? 'listing-card-deferred' : '';
  const href = `${localizePath('/activity', locale)}?id=${listing.activity.id}`;
  const imageUrl = listingImageUrl(listing);
  const title = listingTitle(locale, listing);
  const orgName = listingOrgName(locale, listing);
  const region = regionLabelForListing(locale, listing);
  const schedule = formatScheduleSnippet(locale, listing.schedule.weeklyEntries);
  const price = formatListingPrice(locale, listing);

  return (
    <article
      className={`listing-card ${widthClassName} ${deferClassName}`.trim()}
    >
      <Link href={href} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-brand-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              width={LISTING_IMAGE_WIDTH}
              height={LISTING_IMAGE_HEIGHT}
              loading={imageLoading}
              decoding="async"
              {...(imageFetchPriority
                ? { fetchPriority: imageFetchPriority }
                : {})}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-ink-500">
              {imageAltFallback}
            </div>
          )}
          {listing.pricing.freeTrialClassOffered ? (
            <span className="absolute left-3 top-3 rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink-900 shadow-sm">
              {freeTrialLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold text-ink-900">
            {title}
          </h3>
          <p className="text-sm text-ink-500">
            {[orgName, region, schedule].filter(Boolean).join(' · ')}
          </p>
          <p className="text-sm font-semibold text-ink-900">
            <span>{price}</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
