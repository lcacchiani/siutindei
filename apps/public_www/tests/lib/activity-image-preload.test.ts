import { afterEach, describe, expect, it } from 'vitest';

import { preloadActivityImage } from '@/lib/activity-image-preload';

describe('preloadActivityImage', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('link[rel="preload"]')
      .forEach((node) => node.remove());
  });

  it('inserts and removes a high-priority image preload link', () => {
    const cleanup = preloadActivityImage('https://example.com/hero.jpg');
    const link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="preload"]',
    );
    expect(link?.getAttribute('href')).toBe('https://example.com/hero.jpg');
    expect(link?.getAttribute('fetchpriority')).toBe('high');

    cleanup();
    expect(document.head.querySelector('link[rel="preload"]')).toBeNull();
  });
});
