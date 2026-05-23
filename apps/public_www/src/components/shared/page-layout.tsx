import type { ReactNode } from 'react';

import type { FooterContent, Locale, NavbarContent } from '@/content';
import { Footer } from '@/components/sections/footer';
import { Navbar } from '@/components/sections/navbar';

interface PageLayoutProps {
  readonly locale: Locale;
  readonly navbarContent: NavbarContent;
  readonly footerContent: FooterContent;
  readonly children: ReactNode;
  readonly mainClassName?: string;
  readonly mainId?: string;
}

const DEFAULT_MAIN_CLASSNAME = 'min-h-screen flex-1';

export function PageLayout({
  locale,
  navbarContent,
  footerContent,
  children,
  mainClassName,
  mainId = 'main-content',
}: PageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar locale={locale} content={navbarContent} />
      <main
        id={mainId}
        tabIndex={-1}
        className={mainClassName ?? DEFAULT_MAIN_CLASSNAME}
      >
        {children}
      </main>
      <Footer content={footerContent} />
    </div>
  );
}
