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

function trimEnv(value: string | undefined): string {
  return (value ?? '').trim();
}

function readBooleanEnv(value: string | undefined): boolean {
  const raw = trimEnv(value).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getSiteConfig(): SiteConfig {
  return {
    siteOrigin: trimEnv(process.env.NEXT_PUBLIC_SITE_ORIGIN),
    siteName: trimEnv(process.env.NEXT_PUBLIC_SITE_NAME),
    siteTagline: trimEnv(process.env.NEXT_PUBLIC_SITE_TAGLINE),
    stagingBadgeEnabled: readBooleanEnv(
      process.env.NEXT_PUBLIC_STAGING_BADGE_ENABLED,
    ),
    contact: {
      email: trimEnv(process.env.NEXT_PUBLIC_EMAIL),
      whatsappUrl: trimEnv(process.env.NEXT_PUBLIC_WHATSAPP_URL),
      instagramUrl: trimEnv(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
    },
    search: getSearchConfig(),
  };
}

export function getSearchConfig(): SearchConfig {
  const stagingSearchDataEnabled = readBooleanEnv(
    process.env.NEXT_PUBLIC_STAGING_SEARCH_DATA_ENABLED,
  );
  const siteOrigin = trimEnv(process.env.NEXT_PUBLIC_SITE_ORIGIN).replace(
    /\/$/,
    '',
  );
  const explicitFixtureUrl = trimEnv(
    process.env.NEXT_PUBLIC_STAGING_SEARCH_FIXTURE_URL,
  );
  const stagingSearchFixtureUrl =
    explicitFixtureUrl
    || (stagingSearchDataEnabled && siteOrigin
      ? `${siteOrigin}/fixtures/activity_search_staging.json`
      : '');

  return {
    stagingSearchDataEnabled,
    stagingSearchFixtureUrl,
    apiBaseUrl: trimEnv(process.env.NEXT_PUBLIC_SEARCH_API_BASE_URL),
    apiKey: trimEnv(process.env.NEXT_PUBLIC_SEARCH_API_KEY),
    attestationToken: trimEnv(process.env.NEXT_PUBLIC_DEVICE_ATTESTATION_TOKEN),
  };
}

export function getCopyrightYear(): number {
  const raw = trimEnv(process.env.NEXT_PUBLIC_BUILD_YEAR);
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100) {
    return parsed;
  }

  return new Date().getFullYear();
}

export function resolvePublicSiteConfig(): PublicSiteConfig {
  const whatsappUrl = trimEnv(process.env.NEXT_PUBLIC_WHATSAPP_URL);
  const contactEmail = trimEnv(process.env.NEXT_PUBLIC_EMAIL);
  const instagramUrl = trimEnv(process.env.NEXT_PUBLIC_INSTAGRAM_URL);

  return {
    ...(whatsappUrl ? { whatsappUrl } : {}),
    ...(contactEmail ? { contactEmail } : {}),
    ...(instagramUrl ? { instagramUrl } : {}),
  };
}
