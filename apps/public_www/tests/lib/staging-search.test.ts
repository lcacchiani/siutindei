import { describe, expect, it } from 'vitest';

import { fetchStagingActivitySearch } from '@/lib/activities/staging-search';

describe('fetchStagingActivitySearch', () => {
  it('returns at least 3000 listings without filters', () => {
    const response = fetchStagingActivitySearch({ limit: 5000 });
    expect(response.items.length).toBeGreaterThanOrEqual(3000);
  });

  it('filters by wizard category and age', () => {
    const response = fetchStagingActivitySearch({
      age: 4,
      categoryIds: ['c1111111-1111-1111-1111-111111111102'],
      limit: 20,
    });
    expect(response.items.length).toBe(20);
    for (const item of response.items) {
      expect(item.activity.categoryId).toBe(
        'c1111111-1111-1111-1111-111111111102',
      );
      expect(item.activity.ageMin).toBeLessThanOrEqual(4);
      expect(item.activity.ageMax).toBeGreaterThanOrEqual(4);
      expect(item.schedule.languages).toEqual(['en']);
    }
  });
});
