'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Locale, SiteContent } from '@/content';
import { Button } from '@/components/shared/ui/button';
import { fetchActivityListingById } from '@/lib/activities/search-client';
import {
  formatListingPrice,
  formatScheduleSnippet,
  listingImageUrl,
  listingOrgName,
  listingTitle,
  pickTranslation,
  regionLabelForListing,
} from '@/lib/activities/listing-utils';
import { rememberViewedActivity } from '@/lib/activities/recent-storage';
import type { ActivityListing } from '@/lib/activities/types';
import { getSiteConfig } from '@/lib/site-config';

interface ActivityDetailPageProps {
  readonly locale: Locale;
  readonly activityId: string;
  readonly copy: SiteContent['activityDetail'];
}

function buildWhatsappHref(
  whatsappUrl: string | undefined,
  listing: ActivityListing,
  locale: Locale,
): string | null {
  if (!whatsappUrl) {
    return null;
  }
  const title = listingTitle(locale, listing);
  const message = encodeURIComponent(
    locale === 'zh-HK'
      ? `你好，我想查詢「${title}」的詳情。`
      : `Hi, I would like to ask about "${title}".`,
  );
  const separator = whatsappUrl.includes('?') ? '&' : '?';
  return `${whatsappUrl}${separator}text=${message}`;
}

export function ActivityDetailPage({
  locale,
  activityId,
  copy,
}: ActivityDetailPageProps) {
  const [listing, setListing] = useState<ActivityListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { contact } = getSiteConfig();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    fetchActivityListingById(activityId)
      .then((item) => {
        if (cancelled) {
          return;
        }
        if (!item) {
          setErrorMessage(copy.notFoundLabel);
          setListing(null);
          return;
        }
        setListing(item);
        rememberViewedActivity(item.activity.id);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage(copy.errorLabel);
          setListing(null);
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
  }, [activityId, copy.errorLabel, copy.notFoundLabel]);

  const whatsappHref = useMemo(
    () => (listing ? buildWhatsappHref(contact.whatsappUrl, listing, locale) : null),
    [contact.whatsappUrl, listing, locale],
  );

  if (isLoading) {
    return (
      <p className="mx-auto max-w-4xl px-4 py-16 text-center text-ink-500">
        {copy.loadingLabel}
      </p>
    );
  }

  if (!listing || errorMessage) {
    return (
      <p className="mx-auto max-w-4xl px-4 py-16 text-center text-red-700">
        {errorMessage ?? copy.notFoundLabel}
      </p>
    );
  }

  const title = listingTitle(locale, listing);
  const description = pickTranslation(
    locale,
    listing.activity.description ?? '',
    listing.activity.descriptionTranslations,
  );
  const orgName = listingOrgName(locale, listing);
  const region = regionLabelForListing(locale, listing);
  const schedule = formatScheduleSnippet(locale, listing.schedule.weeklyEntries);
  const price = formatListingPrice(locale, listing);
  const imageUrl = listingImageUrl(listing);

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-ink-500">
              {copy.imageFallbackLabel}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            {orgName}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-lg font-semibold text-ink-900">{price}</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-700">
            {region ? <li>{region}</li> : null}
            {listing.location.address ? <li>{listing.location.address}</li> : null}
            {schedule ? <li>{schedule}</li> : null}
            {listing.pricing.freeTrialClassOffered ? (
              <li>{copy.freeTrialLabel}</li>
            ) : null}
          </ul>
          {description ? (
            <p className="mt-6 leading-7 text-ink-700">{description}</p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {whatsappHref ? (
              <a href={whatsappHref} className="inline-flex">
                <Button type="button" className="w-full sm:w-auto">
                  {copy.whatsappCtaLabel}
                </Button>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
