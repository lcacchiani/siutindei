'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import type { Locale, NavbarContent } from '@/content';
import { localizeHref } from '@/lib/locale-routing';

interface NavbarMobileMenuProps {
  readonly locale: Locale;
  readonly content: NavbarContent;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    ),
  );
}

export function NavbarMobileMenu({ locale, content }: NavbarMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    queueMicrotask(() => {
      menuButtonRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const scrollLockClass = 'navbar-mobile-menu-scroll-lock';
    const hadScrollLock = document.body.classList.contains(scrollLockClass);
    document.body.classList.add(scrollLockClass);

    const main = document.getElementById('main-content');
    const footer = document.getElementById('contact');
    const inertTargets = [main, footer].filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const hadInert = inertTargets.map((element) =>
      element.hasAttribute('inert'),
    );
    inertTargets.forEach((element) => {
      element.setAttribute('inert', '');
    });

    const firstLink = panelRef.current?.querySelector<HTMLElement>('a[href]');
    firstLink?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) {
        return;
      }

      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      if (!hadScrollLock) {
        document.body.classList.remove(scrollLockClass);
      }
      inertTargets.forEach((element, index) => {
        if (hadInert[index]) {
          element.setAttribute('inert', '');
        } else {
          element.removeAttribute('inert');
        }
      });
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, closeMenu]);

  return (
    <div key={pathname} className="md:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        className="relative z-[60] inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-brand-200 px-3 text-sm font-semibold text-brand-700"
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
        <>
          <button
            type="button"
            data-testid="navbar-mobile-menu-backdrop"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label={content.closeNavigationMenuAriaLabel}
            onClick={closeMenu}
          />
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={content.openNavigationMenuAriaLabel}
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
        </>
      ) : null}
    </div>
  );
}
