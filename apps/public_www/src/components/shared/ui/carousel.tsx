'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';

interface CarouselProps {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly previousLabel: string;
  readonly nextLabel: string;
}

const CHEVRON_LEFT_SRC = '/images/ui/chevron-left.svg';
const CHEVRON_RIGHT_SRC = '/images/ui/chevron-right.svg';

function CarouselNavButton({
  label,
  iconSrc,
  onClick,
}: {
  readonly label: string;
  readonly iconSrc: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="listing-carousel__nav inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/15 bg-white p-0 leading-none text-ink-700 hover:bg-brand-50"
      aria-label={label}
      onClick={onClick}
    >
      <img
        src={iconSrc}
        alt=""
        width={12}
        height={12}
        decoding="async"
        aria-hidden="true"
        className="listing-carousel__arrow block h-3 w-3"
      />
    </button>
  );
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
        <CarouselNavButton
          label={previousLabel}
          iconSrc={CHEVRON_LEFT_SRC}
          onClick={() => scrollByDirection(-1)}
        />
        <CarouselNavButton
          label={nextLabel}
          iconSrc={CHEVRON_RIGHT_SRC}
          onClick={() => scrollByDirection(1)}
        />
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
