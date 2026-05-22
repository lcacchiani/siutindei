interface RichTextSectionProps {
  readonly title: string;
  readonly paragraphs: readonly string[];
}

export function RichTextSection({ title, paragraphs }: RichTextSectionProps) {
  return (
    <section className="bg-white" data-section-id="rich-text">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight text-ink-900">
          {title}
        </h2>
        <div className="mt-6 space-y-4 text-lg leading-8 text-ink-700">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
