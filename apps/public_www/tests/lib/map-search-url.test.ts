import { describe, expect, it } from 'vitest';

import { buildMapSearchHref } from '@/lib/activities/map-search-url';
import { DEFAULT_SEARCH_FILTERS } from '@/lib/activities/search-params';

describe('buildMapSearchHref', () => {
  it('includes view=map in the search URL', () => {
    const href = buildMapSearchHref('en', {
      ...DEFAULT_SEARCH_FILTERS,
      regionId: 'kowloon',
    });

    expect(href).toBe('/en/search/?age=3-6&region=kowloon&view=map');
  });
});
