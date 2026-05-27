'use client';

import type { Locale } from '@/content';
import { Carousel } from '@/components/shared/ui/carousel';
import type { ActivityListing } from '@/lib/activities/types';
import {
  listingCardImageLoading,
  shouldDeferListingSectionRender,
} from '@/lib/listing-image';

import { ListingCard } from './listing-card';
import { ListingCardSkeleton } from './listing-card-skeleton';

interface ListingCarouselSectionProps {
  readonly locale: Locale;
  readonly title: string;
  readonly listings: readonly ActivityListing[];
  readonly isLoading: boolean;
  readonly sectionIndex?: number;
  readonly isPrimaryCarousel?: boolean;
  readonly labels: {
    readonly previous: string;
    readonly next: string;
    readonly freeTrial: string;
    readonly imageFallback: string;
    readonly mapAlt: string;
  };
}

export function ListingCarouselSection({
  locale,
  title,
  listings,
  isLoading,
  sectionIndex = 0,
  isPrimaryCarousel = false,
  labels,
}: ListingCarouselSectionProps) {
  const sectionClassName = shouldDeferListingSectionRender(sectionIndex)
    ? 'listing-section-deferred py-8'
    : 'py-8';

  return (
    <section className={sectionClassName} data-section-id="listing-carousel">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-ink-900 sm:text-2xl">
          {title}
        </h2>
        <div className="mt-4">
          <Carousel
            ariaLabel={title}
            previousLabel={labels.previous}
            nextLabel={labels.next}
          >
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <ListingCardSkeleton key={`skeleton-${index}`} />
                ))
              : listings.map((listing, cardIndex) => {
                  const imageProps = listingCardImageLoading({
                    cardIndex,
                    isPrimaryCarousel,
                  });
                  return (
                    <ListingCard
                      key={listing.activity.id}
                      locale={locale}
                      listing={listing}
                      freeTrialLabel={labels.freeTrial}
                      imageAltFallback={labels.imageFallback}
                      mapAltLabel={labels.mapAlt}
                      imageLoading={imageProps.imageLoading}
                      imageFetchPriority={imageProps.imageFetchPriority}
                    />
                  );
                })}
          </Carousel>
        </div>
      </div>
    </section>
  );
}
