'use client';

import type { Locale } from '@/content';
import { Carousel } from '@/components/shared/ui/carousel';
import type { ActivityListing } from '@/lib/activities/types';

import { ListingCard } from './listing-card';
import { ListingCardSkeleton } from './listing-card-skeleton';

interface ListingCarouselSectionProps {
  readonly locale: Locale;
  readonly title: string;
  readonly listings: readonly ActivityListing[];
  readonly isLoading: boolean;
  readonly labels: {
    readonly previous: string;
    readonly next: string;
    readonly freeTrial: string;
    readonly imageFallback: string;
  };
}

export function ListingCarouselSection({
  locale,
  title,
  listings,
  isLoading,
  labels,
}: ListingCarouselSectionProps) {
  return (
    <section className="py-8" data-section-id="listing-carousel">
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
              : listings.map((listing) => (
                  <ListingCard
                    key={listing.activity.id}
                    locale={locale}
                    listing={listing}
                    freeTrialLabel={labels.freeTrial}
                    imageAltFallback={labels.imageFallback}
                  />
                ))}
          </Carousel>
        </div>
      </div>
    </section>
  );
}
