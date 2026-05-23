import { afterEach, describe, expect, it } from 'vitest';

import { getCopyrightYear } from '@/lib/site-config';

describe('getCopyrightYear', () => {
  const originalYear = process.env.NEXT_PUBLIC_BUILD_YEAR;

  afterEach(() => {
    if (originalYear === undefined) {
      delete process.env.NEXT_PUBLIC_BUILD_YEAR;
    } else {
      process.env.NEXT_PUBLIC_BUILD_YEAR = originalYear;
    }
  });

  it('uses NEXT_PUBLIC_BUILD_YEAR when valid', () => {
    process.env.NEXT_PUBLIC_BUILD_YEAR = '2030';
    expect(getCopyrightYear()).toBe(2030);
  });

  it('falls back when env is missing or invalid', () => {
    delete process.env.NEXT_PUBLIC_BUILD_YEAR;
    expect(getCopyrightYear()).toBe(new Date().getFullYear());
  });
});
