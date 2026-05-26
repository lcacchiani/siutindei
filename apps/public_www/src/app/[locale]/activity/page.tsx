import { Suspense } from 'react';

import { ActivityDetailRoute } from '@/components/pages/activity-detail-route';
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
    path: ROUTES.activity,
    title: content.seo.activityDetail.title,
    description: content.seo.activityDetail.description,
    siteName,
    socialImage: {
      url: content.seo.defaultSocialImage,
      alt: content.seo.defaultSocialImageAlt,
    },
  });
}

export default async function ActivityRoutePage({ params }: LocaleRouteProps) {
  const { locale, content } = await resolveLocalePageContext(params);

  return (
    <Suspense fallback={null}>
      <ActivityDetailRoute locale={locale} copy={content.activityDetail} />
    </Suspense>
  );
}
