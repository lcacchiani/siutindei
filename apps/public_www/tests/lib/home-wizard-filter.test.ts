import { describe, expect, it } from 'vitest';

import { filterWizardResults } from '@/lib/home-wizard/filter-results';
import type { ActivitySearchResult } from '@/lib/home-wizard/search-client';

const sampleItems: readonly ActivitySearchResult[] = [
  {
    activity: {
      id: '1',
      name: 'Painting',
      description: 'Art class',
      categoryId: 'c1',
    },
    organization: { name: 'Studio' },
    location: {
      areaId: 'district-1',
      regionAreaId: 'region-hk-island',
    },
  },
  {
    activity: {
      id: '2',
      name: 'Dance',
      description: 'Movement',
      categoryId: 'c2',
    },
    organization: { name: 'Dance Co' },
    location: {
      areaId: 'district-2',
      regionAreaId: 'region-kowloon',
    },
  },
];

describe('filterWizardResults', () => {
  it('filters by macro region', () => {
    const filtered = filterWizardResults(
      sampleItems,
      'region-hk-island',
      '',
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.activity.name).toBe('Painting');
  });

  it('applies free-text search on filtered region results', () => {
    const filtered = filterWizardResults(
      sampleItems,
      'region-kowloon',
      'dance',
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.activity.name).toBe('Dance');
  });
});
