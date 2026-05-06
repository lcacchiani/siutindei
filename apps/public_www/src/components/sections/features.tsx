interface Feature {
  readonly title: string;
  readonly description: string;
}

const FEATURES: readonly Feature[] = [
  {
    title: 'Vetted programs',
    description:
      'Every activity on Siu Tin Dei is reviewed by our team for safety, value, and pedagogical quality.',
  },
  {
    title: 'Hong Kong focused',
    description:
      "Built for HK families: districts, languages, schedules, and pricing that match the city's reality.",
  },
  {
    title: 'Transparent booking',
    description:
      'Clear pricing per session, per class, or per day. No hidden fees, no surprises at checkout.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="bg-white"
      data-section-id="features"
    >
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Why Siu Tin Dei
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-700">
            A focused starting point for parents searching for the right
            activities for their kids.
          </p>
        </div>
        <ul className="mt-12 grid gap-8 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-xl border border-brand-100 bg-brand-50 p-6"
            >
              <h3 className="text-lg font-semibold text-brand-700">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
