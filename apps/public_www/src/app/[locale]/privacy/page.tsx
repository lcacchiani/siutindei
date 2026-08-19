import { LegalPage } from '@/components/sections/legal-page';
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
    path: ROUTES.privacy,
    title: content.seo.privacy.title,
    description: content.seo.privacy.description,
    siteName,
    socialImage: {
      url: content.seo.defaultSocialImage,
      alt: content.seo.defaultSocialImageAlt,
    },
  });
}

export default async function PrivacyRoutePage({ params }: LocaleRouteProps) {
  const { content } = await resolveLocalePageContext(params);

  return (
    <LegalPage
      document={content.legal.privacy}
      lastUpdatedLabel={content.legal.lastUpdatedLabel}
      lastUpdated={content.legal.lastUpdated}
      onThisPageLabel={content.legal.onThisPageLabel}
    />
  );
}
