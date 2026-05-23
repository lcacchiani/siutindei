'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isValidLocale, type Locale, type NavbarContent } from '@/content';
import { localizeHref, normalizeLocalizedPath } from '@/lib/locale-routing';

interface NavbarLanguageSwitcherProps {
  readonly locale: Locale;
  readonly content: NavbarContent;
}

export function NavbarLanguageSwitcher({
  locale,
  content,
}: NavbarLanguageSwitcherProps) {
  const pathname = usePathname();
  const currentPath = normalizeLocalizedPath(pathname ?? '/');

  return (
    <div
      className="flex items-center gap-1"
      role="navigation"
      aria-label={content.languageSelector.menuAriaLabel}
    >
      {content.languageSelector.options.map((option) => {
        if (!isValidLocale(option.locale)) {
          return null;
        }

        return (
          <Link
            key={option.locale}
            href={localizeHref(currentPath, option.locale)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs font-semibold uppercase tracking-wide ${
              option.locale === locale
                ? 'bg-brand-500 text-white'
                : 'text-ink-700 hover:bg-brand-50'
            }`}
            aria-current={option.locale === locale ? 'page' : undefined}
          >
            {option.shortLabel}
          </Link>
        );
      })}
    </div>
  );
}
