import { describe, expect, it } from 'vitest';

import {
  buildSearchQueryString,
  categoryIdsForTypes,
  parseSearchFiltersFromQuery,
  parseSearchViewMode,
} from '@/lib/activities/search-params';

describe('search-params', () => {
  it('round-trips filters in the query string', () => {
    const params = new URLSearchParams(
      buildSearchQueryString({
        ageGroupId: '3-6',
        regionId: 'kowloon',
        activityTypeIds: ['workshop', 'class'],
        textQuery: 'music',
      }),
    );

    const parsed = parseSearchFiltersFromQuery(params);
    expect(parsed.ageGroupId).toBe('3-6');
    expect(parsed.regionId).toBe('kowloon');
    expect(parsed.activityTypeIds).toEqual(['workshop', 'class']);
    expect(parsed.textQuery).toBe('music');
  });

  it('parses map view mode from the query string', () => {
    const params = new URLSearchParams('view=map');
    expect(parseSearchViewMode(params)).toBe('map');
  });

  it('maps activity types to category ids', () => {
    expect(categoryIdsForTypes(['workshop'])).toEqual([
      'c1111111-1111-1111-1111-111111111101',
    ]);
  });
});
