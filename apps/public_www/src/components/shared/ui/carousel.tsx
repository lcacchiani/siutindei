'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';

interface CarouselProps {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly previousLabel: string;
  readonly nextLabel: string;
}

export function Carousel({
  ariaLabel,
  children,
  previousLabel,
  nextLabel,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByDirection(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const amount = Math.max(track.clientWidth * 0.8, 280);
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  return (
    <section className="relative" aria-label={ariaLabel}>
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/15 bg-white text-ink-700 hover:bg-brand-50"
          aria-label={previousLabel}
          onClick={() => scrollByDirection(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/15 bg-white text-ink-700 hover:bg-brand-50"
          aria-label={nextLabel}
          onClick={() => scrollByDirection(1)}
        >
          ›
        </button>
      </div>
      <div
        ref={trackRef}
        className="listing-carousel__track flex gap-4 overflow-x-auto pb-2"
      >
        {children}
      </div>
    </section>
  );
}
