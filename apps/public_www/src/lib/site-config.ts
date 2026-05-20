interface SiteContact {
  readonly email: string;
  readonly whatsappUrl: string;
  readonly instagramUrl: string;
}

export interface SiteConfig {
  readonly siteOrigin: string;
  readonly siteName: string;
  readonly siteTagline: string;
  readonly stagingBadgeEnabled: boolean;
  readonly contact: SiteContact;
}

function readPublicEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function readBooleanEnv(name: string): boolean {
  const raw = readPublicEnv(name).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getSiteConfig(): SiteConfig {
  return {
    siteOrigin: readPublicEnv('NEXT_PUBLIC_SITE_ORIGIN'),
    siteName: readPublicEnv('NEXT_PUBLIC_SITE_NAME'),
    siteTagline: readPublicEnv('NEXT_PUBLIC_SITE_TAGLINE'),
    stagingBadgeEnabled: readBooleanEnv('NEXT_PUBLIC_STAGING_BADGE_ENABLED'),
    contact: {
      email: readPublicEnv('NEXT_PUBLIC_EMAIL'),
      whatsappUrl: readPublicEnv('NEXT_PUBLIC_WHATSAPP_URL'),
      instagramUrl: readPublicEnv('NEXT_PUBLIC_INSTAGRAM_URL'),
    },
  };
}
