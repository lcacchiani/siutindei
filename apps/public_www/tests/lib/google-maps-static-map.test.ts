import { describe, expect, it } from 'vitest';

import { buildStaticMapUrl } from '@/lib/google-maps/static-map-url';

describe('buildStaticMapUrl', () => {
  it('builds a Google Static Maps URL with a marker', () => {
    const url = buildStaticMapUrl({
      apiKey: 'test-key',
      coordinate: { lat: 22.3193, lng: 114.1694 },
      variant: 'card',
    });

    expect(url).toContain('maps.googleapis.com/maps/api/staticmap');
    expect(url).toContain('22.3193');
    expect(url).toContain('114.1694');
    expect(url).toContain('key=test-key');
  });
});
