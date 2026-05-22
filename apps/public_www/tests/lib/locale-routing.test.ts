import { describe, expect, it } from 'vitest';

import { localizeHref, localizePath, normalizeLocalizedPath } from '@/lib/locale-routing';

describe('locale-routing', () => {
  it('localizes internal paths with trailing slash', () => {
    expect(localizePath('/about', 'en')).toBe('/en/about/');
    expect(localizePath('/', 'zh-HK')).toBe('/zh-HK/');
  });

  it('strips locale prefix when normalizing', () => {
    expect(normalizeLocalizedPath('/en/about/')).toBe('/about');
  });

  it('localizes hash and query on internal hrefs', () => {
    expect(localizeHref('/about#contact', 'zh-HK')).toBe('/zh-HK/about/#contact');
  });
});
