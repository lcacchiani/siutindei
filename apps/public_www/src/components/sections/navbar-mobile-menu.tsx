'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';

import type { Locale, NavbarContent } from '@/content';
import { localizeHref } from '@/lib/locale-routing';

interface NavbarMobileMenuProps {
  readonly locale: Locale;
  readonly content: NavbarContent;
}

export function NavbarMobileMenu({ locale, content }: NavbarMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <div key={pathname} className="md:hidden">
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-brand-200 px-3 text-sm font-semibold text-brand-700"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
      >
        <span className="sr-only">
          {isOpen
            ? content.closeNavigationMenuAriaLabel
            : content.openNavigationMenuAriaLabel}
        </span>
        <span aria-hidden="true">{isOpen ? '×' : '☰'}</span>
      </button>
      {isOpen ? (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-50 border-b border-brand-100 bg-white shadow-lg"
        >
          <nav
            className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6"
            aria-label="Main"
          >
            {content.menuItems.map((item) => (
              <Link
                key={item.href}
                href={localizeHref(item.href, locale)}
                className="min-h-11 rounded-md px-3 py-3 text-base font-medium text-ink-700 transition hover:bg-brand-50 hover:text-brand-600"
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
