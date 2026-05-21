import type { MetadataRoute } from 'next';
import { getSiteConfig } from '@/lib/site-config';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteOrigin } = getSiteConfig();
  const now = new Date();
  return [
    {
      url: `${siteOrigin}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
