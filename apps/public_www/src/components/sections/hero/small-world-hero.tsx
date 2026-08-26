import type { Locale, SiteContent } from '@/content';
import { HeroSearchBar } from '@/components/sections/hero/hero-search-bar';
import { FloatingKawaiiBubbles } from '@/components/sections/hero/floating-kawaii-bubbles';
import { SearchNavigator } from '@/components/sections/hero/search-navigator';

interface SmallWorldHeroProps {
  readonly locale: Locale;
  readonly copy: SiteContent['smallWorld'];
  readonly searchBarLabels: SiteContent['navbar']['searchBar'];
}

/**
 * The immersive "Small World" hero: random kawaii Hong Kong pictures
 * in flat circular bubbles, with discovery search front and center.
 */
export function SmallWorldHero({
  locale,
  copy,
  searchBarLabels,
}: SmallWorldHeroProps) {
  return (
    <section className="small-world-hero" aria-label={copy.sceneAriaLabel}>
      <div className="small-world-hero__stars" aria-hidden="true" />
      <FloatingKawaiiBubbles copy={copy} />
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-8 text-center sm:px-6 md:pb-24 md:pt-12">
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
        <SearchNavigator locale={locale} copy={copy.navigator} />
      </div>
    </section>
  );
}
