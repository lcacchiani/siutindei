'use client';

import type { ReactNode } from 'react';

interface CarouselProps {
  readonly ariaLabel: string;
  readonly children: ReactNode;
}

export function Carousel({ ariaLabel, children }: CarouselProps) {
  return (
    <div
      className="listing-carousel__track flex gap-4 overflow-x-auto pb-2"
      role="region"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
