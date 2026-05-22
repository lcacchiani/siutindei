import type { HeroContent, Locale } from '@/content';
import { localizeHref } from '@/lib/locale-routing';

interface HeroSectionProps {
  readonly locale: Locale;
  readonly content: HeroContent;
  readonly eyebrow: string;
  readonly primaryCtaLabel: string;
  readonly primaryCtaHref: string;
  readonly secondaryCtaLabel: string;
  readonly secondaryCtaHref: string;
}

export function HeroSection({
  locale,
  content,
  eyebrow,
  primaryCtaLabel,
  primaryCtaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
}: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="bg-brand-500 text-white"
      data-section-id="hero"
    >
      <div className="mx-auto max-w-5xl px-6 py-24 text-center sm:py-32">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
          {content.title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">
          {content.subtitle}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={localizeHref(primaryCtaHref, locale)}
            className="rounded-full bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
          >
            {primaryCtaLabel}
          </a>
          <a
            href={localizeHref(secondaryCtaHref, locale)}
            className="rounded-full border border-white px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            {secondaryCtaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
