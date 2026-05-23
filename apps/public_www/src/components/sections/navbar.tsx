import Link from 'next/link';

import type { Locale, NavbarContent } from '@/content';
import { localizeHref } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';

import { NavbarLanguageSwitcher } from './navbar-language-switcher';
import { NavbarMobileMenu } from './navbar-mobile-menu';

interface NavbarProps {
  readonly locale: Locale;
  readonly content: NavbarContent;
}

export function Navbar({ locale, content }: NavbarProps) {
  return (
    <header className="relative border-b border-brand-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-14 items-center justify-between gap-3 py-3 sm:min-h-16">
          <Link
            href={localizeHref(ROUTES.home, locale)}
            className="text-base font-bold text-brand-700 sm:text-lg"
          >
            {content.brand}
          </Link>
          <div className="flex items-center gap-2">
            <NavbarLanguageSwitcher locale={locale} content={content} />
            <NavbarMobileMenu locale={locale} content={content} />
          </div>
        </div>
        <nav
          className="hidden border-t border-brand-50 pb-3 pt-2 md:block"
          aria-label="Main"
        >
          <ul className="flex flex-wrap items-center gap-1">
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
  );
}
