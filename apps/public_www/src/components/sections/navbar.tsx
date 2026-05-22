import Link from 'next/link';

import {
  isValidLocale,
  type Locale,
  type NavbarContent,
} from '@/content';
import { localizeHref } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';

interface NavbarProps {
  readonly locale: Locale;
  readonly content: NavbarContent;
  readonly currentPath?: string;
}

export function Navbar({ locale, content, currentPath = ROUTES.home }: NavbarProps) {
  return (
    <header className="border-b border-brand-100 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href={localizeHref(ROUTES.home, locale)}
          className="text-lg font-bold text-brand-700"
        >
          {content.brand}
        </Link>
        <nav
          className="hidden items-center gap-6 text-sm font-medium text-ink-700 md:flex"
          aria-label="Main"
        >
          {content.menuItems.map((item) => (
            <Link
              key={item.href}
              href={localizeHref(item.href, locale)}
              className="transition hover:text-brand-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div
          className="flex items-center gap-2"
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
              className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
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
      </div>
    </header>
  );
}
