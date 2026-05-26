'use client';

import type { Locale, SiteContent } from '@/content';
import { DiscoveryHomeSection } from '@/components/sections/discovery/discovery-home-section';
import { FilterChipRow } from '@/components/sections/search/filter-chip-row';
import { FeaturesSection } from '@/components/sections/grid/features-section';

interface DiscoveryHomePageProps {
  readonly locale: Locale;
  readonly content: SiteContent;
}

export function DiscoveryHomePage({ locale, content }: DiscoveryHomePageProps) {
  return (
    <>
      <FilterChipRow locale={locale} />
      <DiscoveryHomeSection locale={locale} copy={content.discovery} />
      <section className="border-t border-brand-100 bg-brand-50 py-10">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-ink-900">
            {content.hostCta.title}
          </h2>
          <p className="mt-3 text-ink-700">{content.hostCta.description}</p>
          <a
            href={content.hostCta.href}
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white hover:bg-ink-700"
          >
            {content.hostCta.buttonLabel}
          </a>
        </div>
      </section>
      <FeaturesSection content={content.features} />
    </>
  );
}
