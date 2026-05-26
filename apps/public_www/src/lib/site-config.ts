interface SiteContact {
  readonly email: string;
  readonly whatsappUrl: string;
  readonly instagramUrl: string;
}

export interface SearchConfig {
  readonly stagingSearchDataEnabled: boolean;
  readonly stagingSearchFixtureUrl: string;
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly attestationToken: string;
}

export interface SiteConfig {
  readonly siteOrigin: string;
  readonly siteName: string;
  readonly siteTagline: string;
  readonly stagingBadgeEnabled: boolean;
  readonly contact: SiteContact;
  readonly search: SearchConfig;
}

export interface PublicSiteConfig {
  readonly whatsappUrl?: string;
  readonly contactEmail?: string;
  readonly instagramUrl?: string;
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
    search: getSearchConfig(),
  };
}

export function getSearchConfig(): SearchConfig {
  const stagingSearchDataEnabled = readBooleanEnv(
    'NEXT_PUBLIC_STAGING_SEARCH_DATA_ENABLED',
  );
  const siteOrigin = readPublicEnv('NEXT_PUBLIC_SITE_ORIGIN').replace(
    /\/$/,
    '',
  );
  const explicitFixtureUrl = readPublicEnv(
    'NEXT_PUBLIC_STAGING_SEARCH_FIXTURE_URL',
  );
  const stagingSearchFixtureUrl =
    explicitFixtureUrl
    || (stagingSearchDataEnabled && siteOrigin
      ? `${siteOrigin}/fixtures/activity_search_staging.json`
      : '');

  return {
    stagingSearchDataEnabled,
    stagingSearchFixtureUrl,
    apiBaseUrl: readPublicEnv('NEXT_PUBLIC_SEARCH_API_BASE_URL'),
    apiKey: readPublicEnv('NEXT_PUBLIC_SEARCH_API_KEY'),
    attestationToken: readPublicEnv('NEXT_PUBLIC_DEVICE_ATTESTATION_TOKEN'),
  };
}

export function getCopyrightYear(): number {
  const raw = readPublicEnv('NEXT_PUBLIC_BUILD_YEAR');
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100) {
    return parsed;
  }

  return new Date().getFullYear();
}

export function resolvePublicSiteConfig(): PublicSiteConfig {
  const whatsappUrl = readPublicEnv('NEXT_PUBLIC_WHATSAPP_URL');
  const contactEmail = readPublicEnv('NEXT_PUBLIC_EMAIL');
  const instagramUrl = readPublicEnv('NEXT_PUBLIC_INSTAGRAM_URL');

  return {
    ...(whatsappUrl ? { whatsappUrl } : {}),
    ...(contactEmail ? { contactEmail } : {}),
    ...(instagramUrl ? { instagramUrl } : {}),
  };
}
