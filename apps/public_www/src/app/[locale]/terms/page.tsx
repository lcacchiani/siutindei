import {
  generateLocaleStaticParams,
  type LocaleRouteProps,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';
import { buildLocalizedMetadata } from '@/lib/seo';
import { getSiteConfig } from '@/lib/site-config';

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export async function generateMetadata({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const { siteName } = getSiteConfig();

  return buildLocalizedMetadata({
    locale,
    path: ROUTES.terms,
    title: content.seo.terms.title,
    description: content.seo.terms.description,
    siteName,
    socialImage: {
      url: content.seo.defaultSocialImage,
      alt: content.seo.defaultSocialImageAlt,
    },
  });
}

export default async function TermsRoutePage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">
        {content.legal.terms.title}
      </h1>
      {content.legal.terms.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-4 leading-7 text-ink-700">
          {paragraph}
        </p>
      ))}
    </article>
  );
}
