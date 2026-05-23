import { MarketingPage } from '@/components/pages/marketing-page';
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
    path: ROUTES.about,
    title: content.seo.about.title,
    description: content.seo.about.description,
    siteName,
    socialImage: {
      url: content.seo.defaultSocialImage,
      alt: content.seo.defaultSocialImageAlt,
    },
  });
}

export default async function AboutRoutePage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);

  return (
    <MarketingPage
      locale={locale}
      content={content}
      body={content.pages.about.body}
    />
  );
}
