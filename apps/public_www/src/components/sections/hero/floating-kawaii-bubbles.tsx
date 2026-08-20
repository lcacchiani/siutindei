'use client';

import { useEffect, useState } from 'react';

import type { SiteContent } from '@/content';
import {
  BUBBLE_SLOTS,
  LARGE_BUBBLE_COUNT,
  type BubbleId,
  bubbleSrc,
  pickBubbleIds,
} from '@/lib/small-world/kawaii-bubbles';

const DRIFT = [
  'small-world-bubble--drift-a',
  'small-world-bubble--drift-b',
  'small-world-bubble--drift-c',
] as const;

interface FloatingKawaiiBubblesProps {
  readonly copy: SiteContent['smallWorld'];
}

export function FloatingKawaiiBubbles({
  copy,
}: FloatingKawaiiBubblesProps) {
  const [ids, setIds] = useState<readonly BubbleId[] | null>(null);

  useEffect(() => {
    setIds(pickBubbleIds(LARGE_BUBBLE_COUNT));
  }, []);

  if (ids === null) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-label={copy.sceneAriaLabel}
    >
      {ids.map((id, index) => {
        const slot = BUBBLE_SLOTS[index];
        if (!slot) {
          return null;
        }
        const drift = DRIFT[index % DRIFT.length];
        const largeOnly = slot.largeOnly ? 'max-lg:hidden' : '';
        return (
          <img
            key={id}
            src={bubbleSrc(id)}
            alt={copy.bubbles[id]}
            width={160}
            height={160}
            loading="eager"
            decoding="async"
            className={`small-world-bubble ${drift} ${slot.className} ${largeOnly}`}
          />
        );
      })}
    </div>
  );
}
