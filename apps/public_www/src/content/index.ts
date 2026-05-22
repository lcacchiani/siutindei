import enContent from './en.json';
import zhHKContent from './zh-HK.json';

export const SUPPORTED_LOCALES = ['en', 'zh-HK'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

type BaseSiteContent = typeof enContent;
export type SiteContent = BaseSiteContent;

export type NavbarContent = SiteContent['navbar'];
export type FooterContent = SiteContent['footer'];
export type HeroContent = SiteContent['hero'];
export type FeaturesContent = SiteContent['features'];
export type PageBodyConfig = SiteContent['pages'][keyof SiteContent['pages']]['body'];
export type PageBodyGridConfig = PageBodyConfig;
export type PageKey = keyof SiteContent['pages'];

const contentMap = {
  en: enContent,
  'zh-HK': zhHKContent,
} satisfies Record<Locale, BaseSiteContent>;

export function getContent(locale: string): SiteContent {
  if (isValidLocale(locale)) {
    return contentMap[locale];
  }

  return contentMap[DEFAULT_LOCALE];
}

export function isValidLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
