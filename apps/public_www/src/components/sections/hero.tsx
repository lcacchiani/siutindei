import { getSiteConfig } from '@/lib/site-config';

export function Hero() {
  const { siteName, siteTagline } = getSiteConfig();
  return (
    <section
      id="hero"
      className="bg-brand-500 text-white"
      data-section-id="hero"
    >
      <div className="mx-auto max-w-5xl px-6 py-24 text-center sm:py-32">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
          Coming soon
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
          {siteName}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">
          {siteTagline}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#features"
            className="rounded-full bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
          >
            Learn more
          </a>
          <a
            href="#contact"
            className="rounded-full border border-white px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Get in touch
          </a>
        </div>
      </div>
    </section>
  );
}
