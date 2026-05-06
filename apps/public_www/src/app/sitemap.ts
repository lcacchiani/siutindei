import type { MetadataRoute } from 'next';
import { getSiteConfig } from '@/lib/site-config';

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
