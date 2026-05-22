import type { MetadataRoute } from 'next';

import { getSiteHost, getSiteOrigin } from '@/lib/seo';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const siteOrigin = getSiteOrigin();
  const siteHost = getSiteHost();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${siteOrigin}/sitemap.xml`,
    host: siteHost,
  };
}
