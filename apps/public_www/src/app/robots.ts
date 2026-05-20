import type { MetadataRoute } from 'next';
import { getSiteConfig } from '@/lib/site-config';

export const dynamic = 'force-static';

// Production robots.txt. The deploy script overwrites this with a deny-all
// version when syncing to the staging bucket so that staging never gets
// indexed regardless of what is checked in here. CloudFront also adds an
// X-Robots-Tag: noindex response header on the staging distribution.
export default function robots(): MetadataRoute.Robots {
  const { siteOrigin } = getSiteConfig();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
