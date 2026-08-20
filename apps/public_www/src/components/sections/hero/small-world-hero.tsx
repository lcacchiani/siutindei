'use client';

import { useState } from 'react';

import type { Locale, SiteContent } from '@/content';
import { HeroSearchBar } from '@/components/sections/hero/hero-search-bar';
import { SmallWorldScene } from '@/components/sections/hero/small-world-scene';

interface SmallWorldHeroProps {
  readonly locale: Locale;
  readonly copy: SiteContent['smallWorld'];
  readonly searchBarLabels: SiteContent['navbar']['searchBar'];
}

interface FallbackBubble {
  readonly src: string;
  readonly alt: string;
  readonly className: string;
  readonly size: number;
}

/**
 * The immersive "Small World" hero: a sanctuary-like evening-harbour
 * backdrop where miniature Hong Kong landmarks float in glass bubbles
 * (three.js when available, illustrated bubbles otherwise), with the
 * global discovery search front and center.
 */
export function SmallWorldHero({
  locale,
  copy,
  searchBarLabels,
}: SmallWorldHeroProps) {
  const [isSceneReady, setIsSceneReady] = useState(false);

  const fallbackBubbles: readonly FallbackBubble[] = [
    {
      src: '/images/small-world/bubble-peak.svg',
      alt: copy.bubbles.peakAlt,
      className:
        'small-world-bubble small-world-bubble--drift-a right-[4%] top-1/2 w-40 -translate-y-1/2 md:right-[7%] md:w-60 lg:w-72',
      size: 288,
    },
    {
      src: '/images/small-world/bubble-ferry.svg',
      alt: copy.bubbles.ferryAlt,
      className:
        'small-world-bubble small-world-bubble--drift-b left-[3%] top-[10%] w-24 md:left-[6%] md:w-36',
      size: 144,
    },
    {
      src: '/images/small-world/bubble-tram.svg',
      alt: copy.bubbles.tramAlt,
      className:
        'small-world-bubble small-world-bubble--drift-c bottom-[8%] left-[10%] w-20 md:left-[14%] md:w-28',
      size: 112,
    },
  ];

  return (
    <section className="small-world-hero" aria-label={copy.sceneAriaLabel}>
      <div className="small-world-hero__stars" aria-hidden="true" />
      <div
        aria-hidden={isSceneReady}
        className={`absolute inset-0 transition-opacity duration-700 ${
          isSceneReady ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {fallbackBubbles.map((bubble) => (
          <img
            key={bubble.src}
            src={bubble.src}
            alt={bubble.alt}
            width={bubble.size}
            height={bubble.size}
            loading="eager"
            decoding="async"
            className={bubble.className}
          />
        ))}
      </div>
      <SmallWorldScene onReady={() => setIsSceneReady(true)} />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-24">
        <img
          src="/images/brand/siutindei-logo-stacked.svg"
          alt=""
          width={175}
          height={150}
          aria-hidden="true"
          className="mx-auto h-auto w-40 md:w-48"
        />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-glow-300">
          {copy.eyebrow}
        </p>
        <h1 className="brand-title mt-4 text-balance text-3xl font-bold leading-tight text-ink-900 sm:text-4xl md:text-[52px]">
          {copy.title}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-ink-700 md:text-lg">
          {copy.subtitle}
        </p>
        <div className="mt-8">
          <HeroSearchBar locale={locale} labels={searchBarLabels} />
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {copy.trustBadges.map((badge, index) => (
            <li
              key={badge.label}
              className="flex items-center gap-1.5 rounded-full border border-ink-900/10 bg-white/70 px-3 py-1.5 text-xs font-bold text-ink-900 backdrop-blur"
            >
              {index === 0 ? (
                <img
                  src="/images/brand/parent-verified.svg"
                  alt=""
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-glow-300"
                />
              )}
              {badge.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
