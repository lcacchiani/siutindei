'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Locale, NavbarContent } from '@/content';
import { SearchBarCompact } from '@/components/sections/search/search-bar-compact';
import { SearchPanel } from '@/components/sections/search/search-panel';
import { localizeHref, localizePath } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';

import { NavbarLanguageSwitcher } from './navbar-language-switcher';
import { NavbarMobileMenu } from './navbar-mobile-menu';

interface NavbarProps {
  readonly locale: Locale;
  readonly content: NavbarContent;
}

export function Navbar({ locale, content }: NavbarProps) {
  const pathname = usePathname();
  const isHome =
    pathname === localizePath(ROUTES.home, locale) ||
    pathname === `/${locale}` ||
    pathname === `/${locale}/`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center gap-3 py-3">
            <Link
              href={localizeHref(ROUTES.home, locale)}
              className="shrink-0 text-base font-bold text-brand-700 sm:text-lg"
            >
              {content.brand}
            </Link>
            <div className="hidden flex-1 justify-center md:flex">
              <SearchBarCompact locale={locale} labels={content.searchBar} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={content.hostLink.href}
                className="hidden rounded-full border border-ink-900/15 px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-brand-50 lg:inline-flex"
              >
                {content.hostLink.label}
              </Link>
              <NavbarLanguageSwitcher locale={locale} content={content} />
              <NavbarMobileMenu locale={locale} content={content} />
            </div>
          </div>
          <div className="pb-3 md:hidden">
            <SearchBarCompact locale={locale} labels={content.searchBar} />
          </div>
          <nav
            className="hidden border-t border-brand-50 pb-3 pt-2 lg:block"
            aria-label="Main"
          >
            <ul role="list" className="flex flex-wrap items-center gap-1">
              {content.menuItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={localizeHref(item.href, locale)}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink-700 transition hover:bg-brand-50 hover:text-brand-600"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <SearchPanel locale={locale} copy={content.searchPanel} />
      {isHome ? null : (
        <div className="border-b border-brand-100 bg-white md:hidden" />
      )}
    </>
  );
}
