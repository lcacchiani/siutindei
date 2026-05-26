import { describe, expect, it } from 'vitest';

import {
  listingCardImageLoading,
  shouldDeferListingCardRender,
  shouldDeferListingSectionRender,
} from '@/lib/listing-image';

describe('listingCardImageLoading', () => {
  it('prioritizes the first card in the primary carousel', () => {
    expect(
      listingCardImageLoading({ cardIndex: 0, isPrimaryCarousel: true }),
    ).toEqual({ imageLoading: 'eager', imageFetchPriority: 'high' });
  });

  it('eager-loads the second primary carousel card without low priority', () => {
    expect(
      listingCardImageLoading({ cardIndex: 1, isPrimaryCarousel: true }),
    ).toEqual({ imageLoading: 'eager' });
  });

  it('deprioritizes hidden primary carousel slides', () => {
    expect(
      listingCardImageLoading({ cardIndex: 2, isPrimaryCarousel: true }),
    ).toEqual({ imageLoading: 'lazy', imageFetchPriority: 'low' });
  });

  it('lazy-loads non-primary carousel cards', () => {
    expect(
      listingCardImageLoading({ cardIndex: 0, isPrimaryCarousel: false }),
    ).toEqual({ imageLoading: 'lazy' });
  });
});

describe('defer rendering helpers', () => {
  it('defers grid cards from the second row onward', () => {
    expect(shouldDeferListingCardRender(3)).toBe(false);
    expect(shouldDeferListingCardRender(4)).toBe(true);
  });

  it('defers carousel sections after the first', () => {
    expect(shouldDeferListingSectionRender(0)).toBe(false);
    expect(shouldDeferListingSectionRender(1)).toBe(true);
  });
});
