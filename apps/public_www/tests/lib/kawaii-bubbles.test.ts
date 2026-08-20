import { describe, expect, it } from 'vitest';

import {
  BUBBLE_IDS,
  LARGE_BUBBLE_COUNT,
  SMALL_BUBBLE_COUNT,
  bubbleSrc,
  pickBubbleIds,
} from '@/lib/small-world/kawaii-bubbles';

describe('kawaii bubbles', () => {
  it('lists twenty unique bubble ids', () => {
    expect(BUBBLE_IDS).toHaveLength(20);
    expect(new Set(BUBBLE_IDS).size).toBe(20);
  });

  it('picks a unique random subset', () => {
    let next = 0.15;
    const random = () => {
      next = (next + 0.37) % 1;
      return next;
    };

    const picked = pickBubbleIds(LARGE_BUBBLE_COUNT, random);
    expect(picked).toHaveLength(LARGE_BUBBLE_COUNT);
    expect(new Set(picked).size).toBe(LARGE_BUBBLE_COUNT);
    expect(
      picked.every((id) => BUBBLE_IDS.includes(id)),
    ).toBe(true);
    expect(SMALL_BUBBLE_COUNT).toBe(3);
  });

  it('maps ids onto original bubble picture paths', () => {
    expect(bubbleSrc('clock-tower')).toBe(
      '/images/small-world/bubble-clock-tower.webp',
    );
  });
});
