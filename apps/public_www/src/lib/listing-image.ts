/** Intrinsic dimensions for 4:3 listing thumbnails (CLS + decode hints). */
export const LISTING_IMAGE_WIDTH = 400;
export const LISTING_IMAGE_HEIGHT = 300;

export interface ListingCardImageLoadingOptions {
  readonly cardIndex: number;
  readonly isPrimaryCarousel: boolean;
}

export interface ListingCardImageLoadingResult {
  readonly imageLoading: 'lazy' | 'eager';
  readonly imageFetchPriority?: 'high' | 'low';
}

export function listingCardImageLoading({
  cardIndex,
  isPrimaryCarousel,
}: ListingCardImageLoadingOptions): ListingCardImageLoadingResult {
  if (isPrimaryCarousel && cardIndex === 0) {
    return { imageLoading: 'eager', imageFetchPriority: 'high' };
  }

  if (isPrimaryCarousel && cardIndex === 1) {
    return { imageLoading: 'eager' };
  }

  if (isPrimaryCarousel && cardIndex >= 2) {
    return { imageLoading: 'lazy', imageFetchPriority: 'low' };
  }

  return { imageLoading: 'lazy' };
}

export function shouldDeferListingCardRender(cardIndex: number): boolean {
  return cardIndex >= 4;
}

export function shouldDeferListingSectionRender(
  sectionIndex: number,
): boolean {
  return sectionIndex >= 1;
}
